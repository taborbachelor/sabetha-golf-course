import { describe, expect, it } from "vitest";
import {
  availableCarts,
  buildCartBoard,
  needsCart,
  newRoundIds,
  NEXT_ORDER_STEP,
  orderQueue,
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

describe("needsCart", () => {
  it("returns unassigned reservations, earliest arrival first", () => {
    const list = needsCart([
      session({ id: "late", reserved_for: "2026-10-10T18:00:00Z" }),
      session({ id: "assigned", cart_id: "c1" }),
      session({ id: "early", reserved_for: "2026-10-10T14:00:00Z" }),
      session({ id: "gone", status: "returned" }),
    ]);
    expect(list.map((s) => s.id)).toEqual(["early", "late"]);
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
});
