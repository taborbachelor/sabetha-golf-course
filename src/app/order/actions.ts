"use server";

import { isUuid, shortCode } from "@/lib/codes";
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
    };

const PAID: OrderStatus[] = [
  "new",
  "preparing",
  "out_for_delivery",
  "delivered",
];

/**
 * Place and pay for an order to the course. Re-checks that orders are
 * being taken, prices from the database menu (never the browser), saves
 * the order as pending, charges, then marks it 'new' for the kitchen.
 * A failed charge cancels the order.
 */
export async function placeOrder(
  checkoutId: string,
  input: unknown,
  sourceToken: string,
): Promise<OrderResult> {
  const fail = (message: string, extra: Partial<OrderResult> = {}) =>
    ({ ok: false, message, ...extra }) as OrderResult;

  if (!isUuid(checkoutId) || typeof sourceToken !== "string" || !sourceToken) {
    return fail("Something went wrong. Please refresh the page and try again.");
  }
  const parsed = orderSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, { field: String(issue.path[0]) });
  }
  const order = parsed.data;

  const state = await getOrderingState();
  if (!state.accepting) return fail(state.closedReason!, { closed: true });

  const priced = priceOrder(order.items, state.menu, state.kitchen);
  if (!priced.ok)
    return fail(priced.message, { unavailable: priced.unavailable });

  const db = createAdminClient();
  const existing = await db
    .from("orders")
    .select("status, code")
    .eq("id", checkoutId)
    .maybeSingle();
  if (existing.error)
    return fail("Couldn't reach the server. Please try again.");
  if (existing.data && PAID.includes(existing.data.status)) {
    return { ok: true, orderId: checkoutId };
  }
  if (existing.data?.status === "cancelled") {
    return fail("That attempt was cancelled. Please try again.");
  }

  let code = existing.data?.code as string | undefined;
  for (let attempt = 0; attempt < 5 && !code; attempt++) {
    const candidate = shortCode("O");
    const { error } = await db.from("orders").insert({
      id: checkoutId,
      code: candidate,
      hole: order.hole,
      name: order.name,
      phone: order.phone,
      items: priced.lines,
      total_cents: priced.totalCents,
      has_alcohol: priced.hasAlcohol,
      status: "pending",
    });
    if (!error) code = candidate;
    else if (error.code !== "23505") {
      return fail("Couldn't save your order. Please try again.");
    }
  }
  if (!code) return fail("Couldn't save your order. Please try again.");

  const summary = priced.lines.map((l) => `${l.qty}× ${l.name}`).join(", ");
  const charge = await getPayments().charge({
    sourceToken,
    amountCents: priced.totalCents,
    idempotencyKey: checkoutId,
    referenceId: code,
    note: `${code}: hole ${order.hole}: ${summary}`,
  });

  const now = new Date().toISOString();
  if (!charge.ok) {
    await db
      .from("orders")
      .update({ status: "cancelled", updated_at: now })
      .eq("id", checkoutId);
    return fail(charge.message, { declined: charge.declined });
  }

  await db
    .from("orders")
    .update({ status: "new", payment_id: charge.paymentId, updated_at: now })
    .eq("id", checkoutId);
  return { ok: true, orderId: checkoutId };
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
