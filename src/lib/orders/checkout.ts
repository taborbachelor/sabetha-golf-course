import type { ChargeRequest } from "@/lib/payments/types";
import type { OrderLine } from "./order";

/**
 * Order to the Course checkout, kept pure so it's unit-tested. Same rules as
 * Pay to Play (src/lib/rounds/checkout.ts): an order row (id = the browser's
 * checkout ID) goes pending -> new (paid), or pending -> cancelled only when
 * Square definitely didn't take the money. The browser keeps the checkout ID
 * and token until it gets a definite answer, so a retry after a dropped
 * connection replays the same Square request and charges at most once.
 */

export type StoredOrder = {
  id: string;
  code: string;
  hole: number;
  items: OrderLine[];
  total_cents: number;
};

/**
 * The Square request for an order, built only from what was stored when the
 * order was created. A retry must send exactly the same request, or Square
 * rejects the reused idempotency key instead of replaying the charge.
 */
export function chargeRequestForOrder(
  order: StoredOrder,
  sourceToken: string,
): ChargeRequest {
  const summary = order.items.map((l) => `${l.qty}× ${l.name}`).join(", ");
  return {
    sourceToken,
    amountCents: order.total_cents,
    idempotencyKey: order.id,
    referenceId: order.code,
    note: `${order.code}: hole ${order.hole}: ${summary}`,
  };
}
