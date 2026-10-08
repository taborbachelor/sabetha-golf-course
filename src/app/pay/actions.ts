"use server";

import { getSettings } from "@/content/settings";
import { roundWindow } from "@/lib/carts/availability";
import { availableCartCount, cartBalance } from "@/lib/carts/queries";
import { isUuid, shortCode } from "@/lib/codes";
import { formatTime } from "@/lib/hours";
import { getPayments } from "@/lib/payments";
import { quoteRound } from "@/lib/pricing";
import { payFormSchema, resolveArrival, type PayForm } from "@/lib/rounds/form";
import { createAdminClient } from "@/lib/supabase/admin";
import { timeIn } from "@/lib/time";

export type CartCheck =
  { ok: true; available: number } | { ok: false; message: string };

/** How many carts are free for the party's date, arrival and round length. */
export async function checkCarts(
  input: Pick<PayForm, "playDate" | "arrival" | "arrivalTime" | "holes">,
): Promise<CartCheck> {
  const settings = getSettings();
  if (input.holes !== 9 && input.holes !== 18) {
    return { ok: false, message: "Pick 9 or 18 holes" };
  }

  const arrival = resolveArrival(input, {
    timeZone: settings.timeZone,
    bookAheadDays: settings.bookAheadDays,
  });
  if (!arrival.ok) return { ok: false, message: arrival.message };

  try {
    const available = await availableCartCount(
      roundWindow(arrival.arriveAt, settings.roundMinutes[input.holes]),
      settings.roundMinutes,
    );
    return { ok: true, available };
  } catch {
    return { ok: false, message: "Couldn't check carts right now" };
  }
}

export type PayResult =
  | { ok: true; receiptId: string }
  | { ok: false; message: string; field?: string; declined?: boolean };

/** What staff see: the choice plus the clock time, e.g. "~15 min (2:05pm)". */
function arrivalLabel(form: PayForm, arriveAt: Date, timeZone: string) {
  const clock = formatTime(timeIn(timeZone, arriveAt));
  if (form.arrival === "later") return clock;
  const choice = form.arrival === "now" ? "Now" : `~${form.arrival} min`;
  return `${choice} (${clock})`;
}

/**
 * Pay for a round. Everything is re-validated and re-priced here; the
 * browser only supplies the form, a one-time card token and a checkout ID
 * (a UUID it keeps for retries, so a double-tap never charges twice).
 *
 * Order: hold carts -> re-check inventory -> charge -> mark paid. If the
 * charge fails, the hold is released and the round is cancelled.
 */
export async function payForRound(
  checkoutId: string,
  input: unknown,
  sourceToken: string,
): Promise<PayResult> {
  const fail = (message: string, extra: Partial<PayResult> = {}) =>
    ({ ok: false, message, ...extra }) as PayResult;

  if (!isUuid(checkoutId) || typeof sourceToken !== "string" || !sourceToken) {
    return fail("Something went wrong. Please refresh the page and try again.");
  }

  const parsed = payFormSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, { field: String(issue.path[0]) });
  }
  const form = parsed.data;
  const settings = getSettings();

  const arrival = resolveArrival(form, {
    timeZone: settings.timeZone,
    bookAheadDays: settings.bookAheadDays,
  });
  if (!arrival.ok) return fail(arrival.message, { field: arrival.field });

  const quote = quoteRound(form, settings);
  const window = roundWindow(
    arrival.arriveAt,
    settings.roundMinutes[form.holes],
  );
  const db = createAdminClient();

  const existing = await db
    .from("rounds")
    .select("status, code")
    .eq("id", checkoutId)
    .maybeSingle();
  if (existing.error)
    return fail("Couldn't reach the server. Please try again.");
  if (existing.data?.status === "paid")
    return { ok: true, receiptId: checkoutId };
  if (existing.data?.status === "cancelled") {
    return fail("That attempt was cancelled. Please try again.");
  }

  let code = existing.data?.code as string | undefined;

  if (!existing.data) {
    if (form.carts > 0) {
      const available = await availableCartCount(window, settings.roundMinutes);
      if (available < form.carts) {
        return fail(noCartsMessage(available), { field: "carts" });
      }
    }

    // Short codes are unique; retry on the rare collision.
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      const candidate = shortCode("R");
      const { error } = await db.from("rounds").insert({
        id: checkoutId,
        play_date: form.playDate,
        holes: form.holes,
        players: form.players,
        carts: form.carts,
        name: form.name,
        phone: form.phone,
        email: form.email,
        arrival_time: arrivalLabel(form, arrival.arriveAt, settings.timeZone),
        arrive_at: arrival.arriveAt.toISOString(),
        amount_cents: quote.totalCents,
        status: "pending",
        code: candidate,
      });
      if (!error) code = candidate;
      else if (error.code !== "23505") {
        return fail("Couldn't save your round. Please try again.");
      }
    }
    if (!code) return fail("Couldn't save your round. Please try again.");

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
      const balance = error
        ? -1
        : await cartBalance(window, settings.roundMinutes);
      if (balance < 0) {
        await cancelRound(checkoutId);
        return fail(noCartsMessage(0), { field: "carts" });
      }
    }
  }

  const charge = await getPayments().charge({
    sourceToken,
    amountCents: quote.totalCents,
    idempotencyKey: checkoutId,
    referenceId: code!,
    note: `${code}: ${form.players} × ${form.holes} holes, ${form.carts} cart(s), ${form.playDate}`,
  });

  if (!charge.ok) {
    await cancelRound(checkoutId);
    return fail(charge.message, { declined: charge.declined });
  }

  await db
    .from("rounds")
    .update({ status: "paid", payment_id: charge.paymentId })
    .eq("id", checkoutId);

  return { ok: true, receiptId: checkoutId };
}

function noCartsMessage(available: number) {
  return available === 0
    ? "No carts available online for that time. Ask at the clubhouse, or continue without a cart."
    : `Only ${available} cart${available === 1 ? "" : "s"} available online for that time.`;
}

async function cancelRound(id: string) {
  const db = createAdminClient();
  await db.from("cart_sessions").delete().eq("round_id", id);
  await db.from("rounds").update({ status: "cancelled" }).eq("id", id);
}
