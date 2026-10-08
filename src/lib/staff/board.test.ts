import { describe, expect, it } from "vitest";
import {
  availableCarts,
  boardClock,
  buildCartBoard,
  hasStaleNewOrder,
  heldForOnline,
  needsCart,
  newRoundIds,
  NEXT_ORDER_STEP,
  orderQueue,
  partyCartLabels,
  rowSignatures,
  sinceBeforeToday,
  waitingFor,
  type CartRow,
  type SessionRow,
} from "./board";

const carts: CartRow[] = [
  { id: "c3", number: 3, active: true },
  { id: "c1", number: 1, active: true },
  { id: "c2", number: 2, active: true },
  { id: "c9", number: 9, active: false },
];

const session = (over: Partial<SessionRow>): SessionRow => ({
  id: "s",
  cart_id: null,
  round_id: null,
  name: "Pat",
  holes: 18,
  status: "reserved",
  reserved_for: "2026-10-10T15:00:00Z",
  out_at: null,
  source: "online",
  ...over,
});

describe("buildCartBoard", () => {
  it("lists active carts in number order with their current state", () => {
    const board = buildCartBoard(carts, [
      session({
        id: "a",
        cart_id: "c1",
        status: "out",
        out_at: "2026-10-10T14:00:00Z",
        source: "walkin",
      }),
      session({ id: "b", cart_id: "c2", status: "ready" }),
      session({ id: "c", cart_id: "c3", status: "returned" }),
    ]);
    expect(board.map((t) => [t.cart.number, t.state.kind])).toEqual([
      [1, "out"],
      [2, "ready"],
      [3, "available"],
    ]);
  });

  it("shows the most urgent session if a cart is double-booked", () => {
    const board = buildCartBoard(carts, [
      session({ id: "r", cart_id: "c1", status: "reserved" }),
      session({ id: "o", cart_id: "c1", status: "out" }),
    ]);
    expect(board[0].state).toMatchObject({ kind: "out", session: { id: "o" } });
  });

  it("finds available carts", () => {
    const board = buildCartBoard(carts, [
      session({ cart_id: "c2", status: "out" }),
    ]);
    expect(availableCarts(board).map((c) => c.number)).toEqual([1, 3]);
  });
});

const TZ = "America/Chicago";

describe("needsCart", () => {
  const opts = {
    today: "2026-10-10",
    timeZone: TZ,
    paidRoundIds: new Set(["paid", "paid2"]),
  };

  it("returns today's unassigned paid reservations, earliest arrival first", () => {
    const list = needsCart(
      [
        session({
          id: "late",
          round_id: "paid",
          reserved_for: "2026-10-10T18:00:00Z",
        }),
        session({ id: "assigned", round_id: "paid", cart_id: "c1" }),
        session({
          id: "early",
          round_id: "paid2",
          reserved_for: "2026-10-10T14:00:00Z",
        }),
        session({ id: "gone", round_id: "paid", status: "returned" }),
      ],
      opts,
    );
    expect(list.map((s) => s.id)).toEqual(["early", "late"]);
  });

  it("leaves out unpaid rounds and other days (club time)", () => {
    const list = needsCart(
      [
        session({ id: "unpaid", round_id: "pending" }),
        session({ id: "walkin", round_id: null }),
        // 2026-10-09 20:00 in Kansas: yesterday's no-show.
        session({
          id: "yesterday",
          round_id: "paid",
          reserved_for: "2026-10-10T01:00:00Z",
        }),
        // 2026-10-10 23:30 in Kansas: still today there.
        session({
          id: "tonight",
          round_id: "paid",
          reserved_for: "2026-10-11T04:30:00Z",
        }),
        session({ id: "no-time", round_id: "paid", reserved_for: null }),
      ],
      opts,
    );
    expect(list.map((s) => s.id)).toEqual(["tonight"]);
  });
});

describe("heldForOnline", () => {
  const now = new Date("2026-10-10T17:00:00Z");
  const at = (iso: string, id = iso) => session({ id, reserved_for: iso });

  it("counts reservations arriving before a walk-in would be back, and late ones", () => {
    const waiting = [
      at("2026-10-10T16:00:00Z"), // late: still needs a cart
      at("2026-10-10T18:30:00Z"), // inside a 2 hour round
      at("2026-10-10T19:30:00Z"), // after it
    ];
    expect(heldForOnline(waiting, 120, now)).toBe(2);
    expect(heldForOnline(waiting, 240, now)).toBe(3);
    expect(heldForOnline([], 240, now)).toBe(0);
  });
});

describe("partyCartLabels", () => {
  it("numbers the carts of a multi-cart party and skips single carts", () => {
    const labels = partyCartLabels(
      [
        session({ id: "b", round_id: "r1", cart_id: "c1", status: "out" }),
        session({ id: "a", round_id: "r1" }),
        session({ id: "solo", round_id: "r2" }),
        session({ id: "walk", round_id: null, source: "walkin" }),
      ],
      [
        { id: "r1", carts: 2 },
        { id: "r2", carts: 1 },
      ],
    );
    expect(Object.fromEntries(labels)).toEqual({
      a: "cart 1 of 2",
      b: "cart 2 of 2",
    });
  });

  it("keeps the party size after one cart is returned", () => {
    const labels = partyCartLabels(
      [session({ id: "x", round_id: "r1", status: "out" })],
      [{ id: "r1", carts: 2 }],
    );
    expect(labels.get("x")).toBe("cart 1 of 2");
  });
});

describe("since before today", () => {
  const today = "2026-10-08"; // a Thursday
  it("flags a cart out since a previous day (club time) and shows the day", () => {
    // 2026-10-07 16:23 in Kansas (CDT, UTC-5).
    const wed = "2026-10-07T21:23:00Z";
    expect(sinceBeforeToday(wed, today, TZ)).toBe(true);
    expect(boardClock(wed, today, TZ)).toBe("Wed 4:23pm");
  });

  it("treats a late-evening UTC time that is still today in Kansas as today", () => {
    const tonight = "2026-10-09T02:00:00Z"; // 9pm on the 8th in Kansas
    expect(sinceBeforeToday(tonight, today, TZ)).toBe(false);
    expect(boardClock(tonight, today, TZ)).toBe("9pm");
    expect(sinceBeforeToday(null, today, TZ)).toBe(false);
    expect(boardClock(null, today, TZ)).toBe("—");
  });
});

describe("rowSignatures", () => {
  it("changes when a session or order moves on, so a locked button can unlock", () => {
    const before = rowSignatures(
      [session({ id: "s1" })],
      [{ id: "o1", status: "new" }],
    );
    const after = rowSignatures(
      [session({ id: "s1", cart_id: "c1" })],
      [{ id: "o1", status: "preparing" }],
    );
    expect(before.get("s1")).not.toBe(after.get("s1"));
    expect(before.get("o1")).not.toBe(after.get("o1"));
    expect(after.get("gone")).toBeUndefined();
  });
});

describe("newRoundIds", () => {
  it("returns rounds not seen before", () => {
    const rounds = [{ id: "1" }, { id: "2" }] as never[];
    expect(newRoundIds(rounds, new Set(["1"]))).toEqual(["2"]);
  });
});

describe("orders", () => {
  const order = (id: string, created_at: string) =>
    ({ id, created_at, status: "new" }) as never;

  it("queues oldest first", () => {
    const q = orderQueue([
      order("b", "2026-10-10T15:05:00Z"),
      order("a", "2026-10-10T15:00:00Z"),
    ]);
    expect(q.map((o: { id: string }) => o.id)).toEqual(["a", "b"]);
  });

  it("steps New -> Preparing -> On the way -> Delivered", () => {
    expect(NEXT_ORDER_STEP.new.to).toBe("preparing");
    expect(NEXT_ORDER_STEP.preparing.to).toBe("out_for_delivery");
    expect(NEXT_ORDER_STEP.out_for_delivery.to).toBe("delivered");
  });

  it("says how long an order has waited", () => {
    const now = new Date("2026-10-10T16:10:30Z");
    expect(waitingFor("2026-10-10T16:10:10Z", now)).toBe("just now");
    expect(waitingFor("2026-10-10T16:06:00Z", now)).toBe("4 min");
    expect(waitingFor("2026-10-10T15:05:00Z", now)).toBe("1 hr 5 min");
  });

  it("nags only while an order is still New after 2 minutes", () => {
    const now = new Date("2026-10-10T16:10:00Z");
    const o = (status: string, created_at: string) =>
      ({ status, created_at }) as never;
    expect(hasStaleNewOrder([o("new", "2026-10-10T16:09:00Z")], now)).toBe(
      false,
    );
    expect(hasStaleNewOrder([o("new", "2026-10-10T16:08:00Z")], now)).toBe(
      true,
    );
    expect(
      hasStaleNewOrder([o("preparing", "2026-10-10T15:00:00Z")], now),
    ).toBe(false);
  });
});
