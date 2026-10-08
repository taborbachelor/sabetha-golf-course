/**
 * Online cart inventory: total active carts minus carts that are reserved,
 * ready or out during the requested window. Pure, so it's easy to test;
 * the database query lives in ./queries.ts.
 */

import { isAbandoned } from "@/lib/rounds/checkout";

export type HeldCart = {
  /** When the cart is (or was) taken: reserved arrival, or out_at for walk-ins. */
  start: Date;
  /** Expected return. */
  end: Date;
};

export type Window = { start: Date; end: Date };

export function overlaps(a: Window, b: Window): boolean {
  return a.start < b.end && b.start < a.end;
}

export function cartsAvailable(
  activeCarts: number,
  held: HeldCart[],
  window: Window,
): number {
  const busy = held.filter((h) => overlaps(h, window)).length;
  return Math.max(0, activeCarts - busy);
}

export type CartSessionRow = {
  holes: 9 | 18;
  status: "reserved" | "ready" | "out";
  reserved_for: string | null;
  out_at: string | null;
  /** The online round behind a reservation; null for walk-ins. */
  round: { status: string; created_at: string } | null;
};

/**
 * Turn not-yet-returned cart sessions into held time windows. Reservations
 * for a round that never finished paying (still pending after
 * PENDING_HOLD_MINUTES) are skipped, so a crashed checkout can't hold carts
 * forever.
 */
export function heldCarts(
  sessions: CartSessionRow[],
  roundMinutes: Record<9 | 18, number>,
  now: Date = new Date(),
): HeldCart[] {
  return sessions.flatMap((s) => {
    if (s.status === "reserved" && s.round && isAbandoned(s.round, now)) {
      return [];
    }
    const startIso =
      s.status === "out" ? (s.out_at ?? s.reserved_for) : s.reserved_for;
    if (!startIso) return [];
    const start = new Date(startIso);
    // A cart that's out stays unavailable until it's marked Returned, even if late.
    const expectedEnd = start.getTime() + roundMinutes[s.holes] * 60_000;
    const end = new Date(
      s.status === "out" ? Math.max(expectedEnd, now.getTime()) : expectedEnd,
    );
    return [{ start, end }];
  });
}

/**
 * What Pay to Play says when fewer carts are free than the party asked for.
 * No "ask at the clubhouse": golfers often pay here because it's closed.
 */
export function cartsShortMessage(available: number): string {
  return available <= 0
    ? "No carts left online for that time. Set Carts to 0 to pay for golf only."
    : `Only ${available} cart${available === 1 ? "" : "s"} left online for that time. Set Carts to ${available} to continue.`;
}

export function roundWindow(arriveAt: Date, minutes: number): Window {
  return {
    start: arriveAt,
    end: new Date(arriveAt.getTime() + minutes * 60_000),
  };
}
