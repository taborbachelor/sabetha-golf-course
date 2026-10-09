import { describe, expect, it } from "vitest";
import { afterChargeFailure } from "@/lib/rounds/checkout";
import { chargeRequestForOrder, type StoredOrder } from "./checkout";

const order: StoredOrder = {
  id: "7b0d1d1e-3a3c-4d43-9a5e-0c1f0f7c2d11",
  code: "O-AB12",
  hole: 5,
  items: [
    {
      id: "a",
      name: "Domestic beer (can)",
      qty: 2,
      price_cents: 400,
      is_alcohol: true,
    },
    {
      id: "b",
      name: "Hot Dog",
      qty: 1,
      price_cents: 200,
      is_alcohol: false,
    },
  ],
  total_cents: 1000,
};

describe("chargeRequestForOrder", () => {
  it("charges the stored total with the order ID as the idempotency key", () => {
    expect(chargeRequestForOrder(order, "cnon:abc")).toEqual({
      sourceToken: "cnon:abc",
      amountCents: 1000,
      idempotencyKey: order.id,
      referenceId: "O-AB12",
      note: "O-AB12: hole 5: 2× Domestic beer (can), 1× Hot Dog",
    });
  });

  it("builds the identical request on a retry, so Square replays it", () => {
    expect(chargeRequestForOrder(order, "cnon:abc")).toEqual(
      chargeRequestForOrder(structuredClone(order), "cnon:abc"),
    );
  });
});

describe("after a failed order charge", () => {
  const failure = (over: object) => ({
    ok: false as const,
    declined: false,
    retryable: false,
    code: "X",
    message: "m",
    ...over,
  });
  it("keeps the order for a retry when Square may have charged", () => {
    expect(afterChargeFailure(failure({ retryable: true }))).toBe("retry");
    expect(
      afterChargeFailure(failure({ code: "IDEMPOTENCY_KEY_REUSED" })),
    ).toBe("keep");
  });
  it("cancels only on a definite failure", () => {
    expect(
      afterChargeFailure(failure({ declined: true, code: "CARD_DECLINED" })),
    ).toBe("cancel");
  });
});
