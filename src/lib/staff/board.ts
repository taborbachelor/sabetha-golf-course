/** Staff tablet data shapes and the pure logic that turns rows into the board. */

import { todayIn } from "@/lib/dates";
import { formatTime } from "@/lib/hours";
import { timeIn } from "@/lib/time";

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

/** Calendar day "YYYY-MM-DD" of an instant, in the club's time zone. */
export function clubDay(iso: string, timeZone: string): string {
  return todayIn(timeZone, new Date(iso));
}

/**
 * Online reservations still waiting for staff to pick a cart: today's only
 * (club time), and only once the round is paid. Checkout holds the cart
 * session a moment before the card is charged, so an unpaid (abandoned,
 * declined) round never shows here; yesterday's no-shows drop off too.
 */
export function needsCart(
  sessions: SessionRow[],
  opts: { today: string; timeZone: string; paidRoundIds: Set<string> },
): SessionRow[] {
  return sessions
    .filter(
      (s) =>
        s.status === "reserved" &&
        !s.cart_id &&
        s.round_id !== null &&
        opts.paidRoundIds.has(s.round_id) &&
        s.reserved_for !== null &&
        clubDay(s.reserved_for, opts.timeZone) === opts.today,
    )
    .sort(
      (a, b) =>
        (a.reserved_for ?? "").localeCompare(b.reserved_for ?? "") ||
        a.id.localeCompare(b.id),
    );
}

/**
 * How many free carts the reservations in `waiting` (from needsCart) still
 * need, as seen by a walk-in taking a cart now for `minutes`.
 *
 * Same rule as online checkout (lib/carts): a reservation holds a cart for
 * its whole window, so it clashes with any rental whose window overlaps it.
 * A walk-in leaving now overlaps every reservation arriving before the cart
 * is back, plus any that are already late. Reservations that already have a
 * cart are on that cart's tile, so they aren't counted again here.
 */
export function heldForOnline(
  waiting: SessionRow[],
  minutes: number,
  now: Date = new Date(),
): number {
  const until = now.getTime() + minutes * 60_000;
  return waiting.filter(
    (s) => !s.reserved_for || new Date(s.reserved_for).getTime() < until,
  ).length;
}

/**
 * "cart 1 of 2" labels for parties with more than one cart, keyed by
 * session id. Grouped by round; the total is what the golfer paid for, so a
 * party still says "of 2" after one of its carts comes back.
 */
export function partyCartLabels(
  sessions: SessionRow[],
  rounds: Pick<RoundRow, "id" | "carts">[],
): Map<string, string> {
  const groups = new Map<string, SessionRow[]>();
  for (const s of sessions) {
    if (!s.round_id || s.status === "returned") continue;
    groups.set(s.round_id, [...(groups.get(s.round_id) ?? []), s]);
  }
  const labels = new Map<string, string>();
  for (const [roundId, group] of groups) {
    const paid = rounds.find((r) => r.id === roundId)?.carts ?? 0;
    const total = Math.max(group.length, paid);
    if (total < 2) continue;
    [...group]
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((s, i) => labels.set(s.id, `cart ${i + 1} of ${total}`));
  }
  return labels;
}

/**
 * True when a cart has been out (or held for a reservation) since before
 * today, club time: left off the sheet overnight, or a no-show. The tile
 * then shows the date and a red border so staff sort it out.
 */
export function sinceBeforeToday(
  iso: string | null,
  today: string,
  timeZone: string,
): boolean {
  return iso !== null && clubDay(iso, timeZone) < today;
}

/** "4:23pm" today, "Wed 4:23pm" on an earlier day (club time). */
export function boardClock(
  iso: string | null,
  today: string,
  timeZone: string,
): string {
  if (!iso) return "—";
  const date = new Date(iso);
  const time = formatTime(timeIn(timeZone, date));
  if (!sinceBeforeToday(iso, today, timeZone)) return time;
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);
  return `${day} ${time}`;
}

/**
 * What each row on the board looks like right now, keyed by session or
 * order id. After a tap the row's buttons stay locked until this changes
 * (the refreshed data shows the new status), so a fast second tap can't
 * land on the next step's button.
 */
export function rowSignatures(
  sessions: SessionRow[],
  orders: Pick<OrderRow, "id" | "status">[],
): Map<string, string> {
  const sigs = new Map<string, string>();
  for (const s of sessions) sigs.set(s.id, `${s.status}:${s.cart_id ?? ""}`);
  for (const o of orders) sigs.set(o.id, o.status);
  return sigs;
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

/** Whole minutes since `iso`. */
export function minutesSince(iso: string, now: Date = new Date()): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000),
  );
}

/** An order waiting longer than this shows its wait time in red. */
export const LATE_ORDER_MINUTES = 10;

/** A New order nobody has started for this long chimes again. */
export const NAG_NEW_ORDER_MINUTES = 2;

/** True while any order is still New after NAG_NEW_ORDER_MINUTES. */
export function hasStaleNewOrder(
  orders: Pick<OrderRow, "status" | "created_at">[],
  now: Date = new Date(),
): boolean {
  return orders.some(
    (o) =>
      o.status === "new" &&
      minutesSince(o.created_at, now) >= NAG_NEW_ORDER_MINUTES,
  );
}

/** "just now", "4 min", "1 hr 5 min" since `iso`. */
export function waitingFor(iso: string, now: Date = new Date()): string {
  const minutes = minutesSince(iso, now);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}
