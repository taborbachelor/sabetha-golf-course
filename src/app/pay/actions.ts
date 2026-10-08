"use server";

import { getSettings } from "@/lib/settings";
import { cartsShortMessage, roundWindow } from "@/lib/carts/availability";
import { availableCartCount, cartBalance } from "@/lib/carts/queries";
import { isUuid, shortCode } from "@/lib/codes";
import { formatTime } from "@/lib/hours";
import { getPayments } from "@/lib/payments";
import { quoteRound } from "@/lib/pricing";
import {
  afterChargeFailure,
  chargeRequestFor,
  DROPPED_MESSAGE,
  type StoredRound,
} from "@/lib/rounds/checkout";
import {
  ANY_TIME_LABEL,
  payFormSchema,
  resolveArrival,
  type PayForm,
} from "@/lib/rounds/form";
import { createAdminClient } from "@/lib/supabase/admin";
import { timeIn } from "@/lib/time";

export type CartCheck =
  { ok: true; available: number } | { ok: false; message: string };

/** How many carts are free for the party's date, arrival and round length. */
export async function checkCarts(
  input: Pick<PayForm, "playDate" | "arrival" | "arrivalTime" | "holes">,
): Promise<CartCheck> {
  const settings = await getSettings();
  if (input.holes !== 9 && input.holes !== 18) {
    return { ok: false, message: "Pick 9 or 18 holes" };
  }

  const arrival = resolveArrival(
    // Asked on behalf of a cart, so a time is required.
    { ...input, carts: 1 },
    settings,
  );
  if (!arrival.ok) return { ok: false, message: arrival.message };

  try {
    const available = await availableCartCount(
      roundWindow(arrival.arriveAt, settings.roundMinutes[input.holes]),
      settings.roundMinutes,
    );
    return { ok: true, available };
  } catch {
    return {
      ok: false,
      message: "Couldn't check carts. Set Carts to 0, or try again.",
    };
  }
}

export type PayResult =
  | { ok: true; receiptId: string }
  | {
      ok: false;
      message: string;
      field?: keyof PayForm;
      declined?: boolean;
      /**
       * The payment may have gone through: keep the checkout ID and card
       * token, and send them again. The retry settles it without a second charge.
       */
      retrySame?: boolean;
      /** Online cart inventory changed: check carts again. */
      cartsChanged?: boolean;
    };

/** What staff see: the choice plus the clock time, e.g. "~15 min (2:05pm)". */
function arrivalLabel(
  form: PayForm,
  arrival: { arriveAt: Date; anyTime: boolean },
  timeZone: string,
) {
  if (arrival.anyTime) return ANY_TIME_LABEL;
  const clock = formatTime(timeIn(timeZone, arrival.arriveAt));
  if (form.arrival === "later") return clock;
  const choice = form.arrival === "now" ? "Now" : `~${form.arrival} min`;
  return `${choice} (${clock})`;
}

const ROUND_COLUMNS =
  "id, status, code, play_date, holes, players, carts, amount_cents";

/**
 * Pay for a round. Everything is re-validated and re-priced here; the
 * browser only supplies the form, a one-time card token and a checkout ID
 * (a UUID it keeps, with the token, until it gets a definite answer).
 *
 * Order: hold carts -> re-check inventory -> charge -> mark paid. Only a
 * definite failure (declined card, bad token) cancels the round and
 * releases its carts. When we can't tell whether Square charged (dropped
 * connection, timeout, 5xx) the round stays pending and the browser retries
 * with the same checkout ID and token: that replays the same Square request,
 * so the card is charged at most once. A retry of a pending round charges
 * exactly what was stored when it was created, whatever the form says now.
 */
export async function payForRound(
  checkoutId: string,
  input: unknown,
  sourceToken: string,
): Promise<PayResult> {
  const fail = (message: string, extra: Partial<PayResult> = {}) =>
    ({ ok: false, message, ...extra }) as PayResult;
  const retry = (message = DROPPED_MESSAGE) =>
    fail(message, { retrySame: true });

  if (!isUuid(checkoutId) || typeof sourceToken !== "string" || !sourceToken) {
    return fail("Something went wrong. Please refresh the page and try again.");
  }

  const parsed = payFormSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, { field: issue.path[0] as keyof PayForm });
  }
  const form = parsed.data;
  const db = createAdminClient();

  const existing = await db
    .from("rounds")
    .select(ROUND_COLUMNS)
    .eq("id", checkoutId)
    .maybeSingle<StoredRound & { status: string }>();
  // An earlier try of this checkout may have charged; keep it for a retry.
  if (existing.error) return retry();
  if (existing.data?.status === "paid")
    return { ok: true, receiptId: checkoutId };
  if (existing.data && existing.data.status !== "pending") {
    return fail("That attempt was cancelled. Please try again.");
  }

  let round: StoredRound | null = existing.data;

  if (!round) {
    const settings = await getSettings();
    const arrival = resolveArrival(form, settings);
    if (!arrival.ok) {
      return fail(arrival.message, { field: arrival.field as keyof PayForm });
    }

    const quote = quoteRound(form, settings);
    const window = roundWindow(
      arrival.arriveAt,
      settings.roundMinutes[form.holes],
    );

    if (form.carts > 0) {
      let available: number;
      try {
        available = await availableCartCount(window, settings.roundMinutes);
      } catch {
        return fail("Couldn't check carts. Set Carts to 0, or try again.", {
          field: "carts",
          cartsChanged: true,
        });
      }
      if (available < form.carts) {
        return fail(cartsShortMessage(available), {
          field: "carts",
          cartsChanged: true,
        });
      }
    }

    // Short codes are unique; retry on the rare collision.
    for (let attempt = 0; attempt < 5 && !round; attempt++) {
      const row = {
        id: checkoutId,
        play_date: form.playDate,
        holes: form.holes,
        players: form.players,
        carts: form.carts,
        amount_cents: quote.totalCents,
        code: shortCode("R"),
      };
      const { error } = await db.from("rounds").insert({
        ...row,
        name: form.name,
        phone: form.phone,
        email: form.email,
        arrival_time: arrivalLabel(form, arrival, settings.timeZone),
        arrive_at: arrival.arriveAt.toISOString(),
        status: "pending",
      });
      if (!error) round = row;
      else if (error.code !== "23505") {
        return fail("Couldn't save your round. Please try again.");
      } else if (error.message.includes("rounds_pkey")) {
        // An earlier try of this same checkout is still running on the server.
        return retry(
          "Still finishing your payment. Tap Pay again in a moment — you won't be charged twice.",
        );
      }
    }
    if (!round) return fail("Couldn't save your round. Please try again.");

    if (form.carts > 0) {
      const { error } = await db.from("cart_sessions").insert(
        Array.from({ length: form.carts }, () => ({
          round_id: checkoutId,
          name: form.name,
          holes: form.holes,
          status: "reserved",
          reserved_for: arrival.arriveAt.toISOString(),
          source: "online",
        })),
      );
      // Someone else may have taken the last cart between check and hold.
      // Nothing has been charged yet, so backing out here is always safe.
      let balance = -1;
      if (!error) {
        try {
          balance = await cartBalance(window, settings.roundMinutes);
        } catch {
          // Treated as no carts: cancel and let the golfer try again.
        }
      }
      if (balance < 0) {
        await cancelRound(checkoutId);
        const left = Math.max(0, form.carts + balance);
        return fail(cartsShortMessage(error ? 0 : left), {
          field: "carts",
          cartsChanged: true,
        });
      }
    }
  }

  const charge = await getPayments().charge(
    chargeRequestFor(round, sourceToken),
  );

  if (!charge.ok) {
    switch (afterChargeFailure(charge)) {
      case "retry":
        return retry();
      case "keep":
        return fail("The payment didn't go through. Please try again.");
      case "cancel":
        await cancelRound(checkoutId);
        return fail(charge.message, { declined: charge.declined });
    }
  }

  // The card is charged. If saving that fails, a retry replays the same
  // Square request (no new charge) and tries the save again.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await db
      .from("rounds")
      .update({ status: "paid", payment_id: charge.paymentId })
      .eq("id", checkoutId);
    if (!error) return { ok: true, receiptId: checkoutId };
  }
  return retry(
    "Your card went through but we couldn't save it. Tap Pay again to finish — you won't be charged twice.",
  );
}

async function cancelRound(id: string) {
  const db = createAdminClient();
  await db.from("cart_sessions").delete().eq("round_id", id);
  await db.from("rounds").update({ status: "cancelled" }).eq("id", id);
}
