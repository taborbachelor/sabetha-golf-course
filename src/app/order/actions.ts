"use server";

import { isUuid, shortCode } from "@/lib/codes";
import { chargeRequestForOrder, type StoredOrder } from "@/lib/orders/checkout";
import { afterChargeFailure, DROPPED_MESSAGE } from "@/lib/rounds/checkout";
import {
  orderSchema,
  priceOrder,
  type OrderStatus,
  type UnavailableItem,
} from "@/lib/orders/order";
import { getOrderingState } from "@/lib/orders/state";
import { getPayments } from "@/lib/payments";
import { createAdminClient } from "@/lib/supabase/admin";

export type OrderResult =
  | { ok: true; orderId: string }
  | {
      ok: false;
      message: string;
      field?: string;
      declined?: boolean;
      /** Ordering stopped since the page loaded (refresh to show why). */
      closed?: boolean;
      /** Items in the order that can't be ordered right now. */
      unavailable?: UnavailableItem[];
      /**
       * The payment may have gone through: keep the checkout ID and token
       * and send them again. The retry settles it without a second charge.
       */
      retrySame?: boolean;
    };

const PAID: OrderStatus[] = [
  "new",
  "preparing",
  "out_for_delivery",
  "delivered",
];

const ORDER_COLUMNS = "id, status, code, hole, items, total_cents";

/**
 * Place and pay for an order to the course. Re-checks that orders are
 * being taken, prices from the database menu (never the browser), saves
 * the order as pending, charges, then marks it 'new' for the kitchen.
 *
 * Only a definite failure (declined card, bad token) cancels the order.
 * When we can't tell whether Square charged (dropped connection, timeout,
 * 5xx) the order stays pending and the browser retries with the same
 * checkout ID and token: that replays the same Square request, built from
 * the stored order, so the card is charged at most once.
 */
export async function placeOrder(
  checkoutId: string,
  input: unknown,
  sourceToken: string,
): Promise<OrderResult> {
  const fail = (message: string, extra: Partial<OrderResult> = {}) =>
    ({ ok: false, message, ...extra }) as OrderResult;
  const retry = (message = DROPPED_MESSAGE) =>
    fail(message, { retrySame: true });

  if (!isUuid(checkoutId) || typeof sourceToken !== "string" || !sourceToken) {
    return fail("Something went wrong. Please refresh the page and try again.");
  }
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, { field: String(issue.path[0]) });
  }
  const db = createAdminClient();

  const existing = await db
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("id", checkoutId)
    .maybeSingle<StoredOrder & { status: OrderStatus }>();
  // An earlier try of this checkout may have charged; keep it for a retry.
  if (existing.error) return retry();
  if (existing.data && PAID.includes(existing.data.status)) {
    return { ok: true, orderId: checkoutId };
  }
  if (existing.data && existing.data.status !== "pending") {
    return fail("That attempt was cancelled. Please try again.");
  }

  // A pending order is a retry: charge exactly what was stored, even if
  // the kitchen or menu changed since (the first try may have charged).
  let order: StoredOrder | null = existing.data;

  if (!order) {
    const form = parsed.data;
    const state = await getOrderingState();
    if (!state.accepting) return fail(state.closedReason!, { closed: true });

    const priced = priceOrder(form.items, state.menu, state.kitchen);
    if (!priced.ok)
      return fail(priced.message, { unavailable: priced.unavailable });

    // Short codes are unique; retry on the rare collision.
    for (let attempt = 0; attempt < 5 && !order; attempt++) {
      const row = {
        id: checkoutId,
        code: shortCode("O"),
        hole: form.hole,
        items: priced.lines,
        total_cents: priced.totalCents,
      };
      const { error } = await db.from("orders").insert({
        ...row,
        name: form.name,
        phone: form.phone,
        has_alcohol: priced.hasAlcohol,
        status: "pending",
      });
      if (!error) order = row;
      else if (error.code !== "23505") {
        return fail("Couldn't save your order. Please try again.");
      } else if (error.message.includes("orders_pkey")) {
        // An earlier try of this same checkout is still running on the server.
        return retry(
          "Still finishing your payment. Tap Pay again in a moment — you won't be charged twice.",
        );
      }
    }
    if (!order) return fail("Couldn't save your order. Please try again.");
  }

  const charge = await getPayments().charge(
    chargeRequestForOrder(order, sourceToken),
  );

  if (!charge.ok) {
    switch (afterChargeFailure(charge)) {
      case "retry":
        return retry();
      case "keep":
        return fail("The payment didn't go through. Please try again.");
      case "cancel":
        await db
          .from("orders")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", checkoutId);
        return fail(charge.message, { declined: charge.declined });
    }
  }

  // The card is charged. If saving that fails, a retry replays the same
  // Square request (no new charge) and tries the save again.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { error } = await db
      .from("orders")
      .update({
        status: "new",
        payment_id: charge.paymentId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", checkoutId);
    if (!error) return { ok: true, orderId: checkoutId };
  }
  return retry(
    "Your card went through but we couldn't save your order. Tap Pay again to finish — you won't be charged twice.",
  );
}

export type OrderStatusView = {
  status: OrderStatus;
  updatedAt: string;
};

/** Polled by the golfer's status page. Looked up by the unguessable ID only. */
export async function getOrderStatus(
  id: string,
): Promise<OrderStatusView | null> {
  if (!isUuid(id)) return null;
  const { data } = await createAdminClient()
    .from("orders")
    .select("status, updated_at")
    .eq("id", id)
    .maybeSingle();
  return data ? { status: data.status, updatedAt: data.updated_at } : null;
}
