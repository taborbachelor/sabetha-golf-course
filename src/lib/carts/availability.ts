/**
 * Online cart inventory: total active carts minus carts that are reserved,
 * ready or out during the requested window. Pure, so it's easy to test;
 * the database query lives in ./queries.ts.
 */

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

export function roundWindow(arriveAt: Date, minutes: number): Window {
  return {
    start: arriveAt,
    end: new Date(arriveAt.getTime() + minutes * 60_000),
  };
}
