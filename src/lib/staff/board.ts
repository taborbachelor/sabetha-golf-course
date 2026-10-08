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

/** IDs of rounds that arrived since `seen`, for the chime. */
export function newRoundIds(rounds: RoundRow[], seen: Set<string>): string[] {
  return rounds.filter((r) => !seen.has(r.id)).map((r) => r.id);
}
