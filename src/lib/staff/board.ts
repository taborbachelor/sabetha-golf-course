/** Staff tablet data shapes and the pure logic that turns rows into the board. */

export type CartRow = { id: string; number: number; active: boolean };

export type SessionStatus = "reserved" | "ready" | "out" | "returned";

export type SessionRow = {
  id: string;
  cart_id: string | null;
  round_id: string | null;
  name: string;
  holes: 9 | 18;
  status: SessionStatus;
  reserved_for: string | null;
  out_at: string | null;
  source: "online" | "walkin";
};

export type RoundRow = {
  id: string;
  code: string;
  name: string;
  holes: 9 | 18;
  players: number;
  carts: number;
  arrival_time: string | null;
  arrive_at: string | null;
  amount_cents: number;
  created_at: string;
};

export type CartState =
  | { kind: "available" }
  | { kind: "reserved" | "ready" | "out"; session: SessionRow };

export type CartTile = { cart: CartRow; state: CartState };

const ORDER: Record<SessionStatus, number> = {
  out: 0,
  ready: 1,
  reserved: 2,
  returned: 3,
};

/**
 * One tile per active cart. A cart with an assigned session that isn't
 * returned shows that session (out wins over ready over reserved, in case
 * of a double booking); otherwise it's available.
 */
export function buildCartBoard(
  carts: CartRow[],
  sessions: SessionRow[],
): CartTile[] {
  return carts
    .filter((c) => c.active)
    .sort((a, b) => a.number - b.number)
    .map((cart) => {
      const session = sessions
        .filter((s) => s.cart_id === cart.id && s.status !== "returned")
        .sort((a, b) => ORDER[a.status] - ORDER[b.status])[0];
      return {
        cart,
        state: session
          ? { kind: session.status as "reserved" | "ready" | "out", session }
          : { kind: "available" },
      };
    });
}

/** Online reservations still waiting for staff to pick a cart. */
export function needsCart(sessions: SessionRow[]): SessionRow[] {
  return sessions
    .filter((s) => s.status === "reserved" && !s.cart_id)
    .sort((a, b) => (a.reserved_for ?? "").localeCompare(b.reserved_for ?? ""));
}

/** Carts that can be handed out right now. */
export function availableCarts(board: CartTile[]): CartRow[] {
  return board.filter((t) => t.state.kind === "available").map((t) => t.cart);
}

/** IDs of rounds or orders that arrived since `seen`, for the chime. */
export function newRoundIds(
  rows: { id: string }[],
  seen: Set<string>,
): string[] {
  return rows.filter((r) => !seen.has(r.id)).map((r) => r.id);
}

export type OrderQueueStatus = "new" | "preparing" | "out_for_delivery";

export type OrderRow = {
  id: string;
  code: string;
  hole: number;
  name: string;
  phone: string;
  items: { id: string; name: string; qty: number; is_alcohol: boolean }[];
  total_cents: number;
  has_alcohol: boolean;
  status: OrderQueueStatus;
  created_at: string;
};

/** The one button each order shows, moving it to the next status. */
export const NEXT_ORDER_STEP: Record<
  OrderQueueStatus,
  { to: "preparing" | "out_for_delivery" | "delivered"; label: string }
> = {
  new: { to: "preparing", label: "Start" },
  preparing: { to: "out_for_delivery", label: "Send out" },
  out_for_delivery: { to: "delivered", label: "Delivered" },
};

export const ORDER_STATUS_LABEL: Record<OrderQueueStatus, string> = {
  new: "New",
  preparing: "Preparing",
  out_for_delivery: "On the way",
};

/** Open orders, oldest first: whoever has waited longest is at the top. */
export function orderQueue(orders: OrderRow[]): OrderRow[] {
  return [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** "just now", "4 min", "1 hr 5 min" since `iso`. */
export function waitingFor(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(
    0,
    Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000),
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}
