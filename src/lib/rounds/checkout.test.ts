import { describe, expect, it } from "vitest";
import {
  cartsShortMessage,
  heldCarts,
  type CartSessionRow,
} from "@/lib/carts/availability";
import type { ChargeResult } from "@/lib/payments/types";
import {
  afterChargeFailure,
  chargeRequestFor,
  isAbandoned,
  PENDING_HOLD_MINUTES,
} from "./checkout";

type Failure = Extract<ChargeResult, { ok: false }>;
const failure = (over: Partial<Failure>): Failure => ({
  ok: false,
  declined: false,
  retryable: false,
  code: "X",
  message: "m",
  ...over,
});

describe("afterChargeFailure", () => {
  it("keeps the round and its carts when we can't tell if Square charged", () => {
    // Charge never reached Square, or it did and the reply was lost: either
    // way the retry with the same key settles it.
    for (const code of ["NETWORK_ERROR", "TIMEOUT", "HTTP_502", "HTTP_200"]) {
      expect(afterChargeFailure(failure({ retryable: true, code }))).toBe(
        "retry",
      );
    }
  });

  it("cancels only on a definite failure", () => {
    expect(
      afterChargeFailure(failure({ declined: true, code: "GENERIC_DECLINE" })),
    ).toBe("cancel");
    expect(afterChargeFailure(failure({ code: "CARD_TOKEN_USED" }))).toBe(
      "cancel",
    );
  });

  it("never cancels a round whose idempotency key was already used", () => {
    expect(
      afterChargeFailure(failure({ code: "IDEMPOTENCY_KEY_REUSED" })),
    ).toBe("keep");
  });
});

describe("chargeRequestFor", () => {
  const round = {
    id: "3f1d2c4e-0000-4000-8000-000000000001",
    code: "R-ABC123",
    play_date: "2026-10-10",
    holes: 18,
    players: 2,
    carts: 1,
    amount_cents: 9000,
  };

  it("builds the same Square request every time, from the stored round", () => {
    const first = chargeRequestFor(round, "cnon:1");
    expect(first).toEqual({
      sourceToken: "cnon:1",
      amountCents: 9000,
      idempotencyKey: round.id,
      referenceId: "R-ABC123",
      note: "R-ABC123: 2 × 18 holes, 1 cart(s), 2026-10-10",
    });
    expect(chargeRequestFor({ ...round }, "cnon:1")).toEqual(first);
  });
});

describe("isAbandoned (pending hold cutoff)", () => {
  const created = "2026-10-07T19:00:00Z";
  const after = (min: number) =>
    new Date(new Date(created).getTime() + min * 60_000);

  it("expires pending rounds after the hold window only", () => {
    const pending = { status: "pending", created_at: created };
    expect(isAbandoned(pending, after(PENDING_HOLD_MINUTES - 1))).toBe(false);
    expect(isAbandoned(pending, after(PENDING_HOLD_MINUTES))).toBe(false);
    expect(isAbandoned(pending, after(PENDING_HOLD_MINUTES + 1))).toBe(true);
  });

  it("never expires paid or cancelled rounds", () => {
    for (const status of ["paid", "cancelled", "refunded"]) {
      expect(isAbandoned({ status, created_at: created }, after(600))).toBe(
        false,
      );
    }
  });
});

describe("heldCarts", () => {
  const now = new Date("2026-10-07T19:30:00Z");
  const minutes = { 9: 120, 18: 240 } as const;
  const reservation = (round: CartSessionRow["round"]): CartSessionRow => ({
    holes: 9,
    status: "reserved",
    reserved_for: "2026-10-07T20:00:00Z",
    out_at: null,
    round,
  });

  it("ignores reservations of checkouts that never finished paying", () => {
    const held = heldCarts(
      [
        reservation({ status: "paid", created_at: "2026-10-07T18:00:00Z" }),
        // Pending 5 minutes: still paying, so it holds the cart.
        reservation({ status: "pending", created_at: "2026-10-07T19:25:00Z" }),
        // Pending 30 minutes: abandoned, so the cart is free again.
        reservation({ status: "pending", created_at: "2026-10-07T19:00:00Z" }),
        reservation(null), // walk-in / staff reservation
      ],
      minutes,
      now,
    );
    expect(held).toHaveLength(3);
    expect(held[0]).toEqual({
      start: new Date("2026-10-07T20:00:00Z"),
      end: new Date("2026-10-07T22:00:00Z"),
    });
  });

  it("keeps a late cart that's out held until it's returned", () => {
    const [held] = heldCarts(
      [
        {
          holes: 9,
          status: "out",
          reserved_for: null,
          out_at: "2026-10-07T16:00:00Z",
          round: null,
        },
      ],
      minutes,
      now,
    );
    expect(held.end).toEqual(now);
  });
});

describe("cartsShortMessage", () => {
  it("tells the golfer what to do without sending them to the clubhouse", () => {
    expect(cartsShortMessage(0)).toBe(
      "No carts left online for that time. Set Carts to 0 to pay for golf only.",
    );
    expect(cartsShortMessage(1)).toBe(
      "Only 1 cart left online for that time. Set Carts to 1 to continue.",
    );
    expect(cartsShortMessage(2)).toMatch(/^Only 2 carts left/);
    expect(cartsShortMessage(-1)).toMatch(/^No carts left/);
  });
});
