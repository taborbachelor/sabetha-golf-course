import { describe, expect, it, vi } from "vitest";
import { createSquareProvider, SQUARE_SANDBOX_URL } from "./square";

const config = {
  environment: "sandbox" as const,
  accessToken: "test-token",
  locationId: "LOC123",
};

const request = {
  sourceToken: "cnon:card-nonce-ok",
  amountCents: 5500,
  idempotencyKey: "round-abc",
  referenceId: "round-abc",
  note: "18 holes, 2 players",
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

describe("Square provider", () => {
  it("sends the amount in cents to the sandbox payments endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        payment: { id: "pay_1", status: "COMPLETED", receipt_url: "https://r" },
      }),
    );
    const result = await createSquareProvider(config, fetchMock).charge(
      request,
    );

    expect(result).toEqual({
      ok: true,
      paymentId: "pay_1",
      status: "COMPLETED",
      receiptUrl: "https://r",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${SQUARE_SANDBOX_URL}/v2/payments`);
    expect(init.headers.Authorization).toBe("Bearer test-token");
    expect(JSON.parse(init.body)).toMatchObject({
      source_id: "cnon:card-nonce-ok",
      idempotency_key: "round-abc",
      amount_money: { amount: 5500, currency: "USD" },
      location_id: "LOC123",
    });
  });

  it("reports a declined card as declined", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(400, {
        errors: [{ code: "GENERIC_DECLINE", category: "PAYMENT_METHOD_ERROR" }],
      }),
    );
    const result = await createSquareProvider(config, fetchMock).charge(
      request,
    );
    expect(result).toMatchObject({
      ok: false,
      declined: true,
      code: "GENERIC_DECLINE",
    });
  });

  it("treats API and network failures as not declined", async () => {
    const apiError = vi.fn().mockResolvedValue(
      jsonResponse(401, {
        errors: [{ code: "UNAUTHORIZED", category: "AUTHENTICATION_ERROR" }],
      }),
    );
    expect(
      await createSquareProvider(config, apiError).charge(request),
    ).toMatchObject({ ok: false, declined: false, code: "UNAUTHORIZED" });

    const network = vi.fn().mockRejectedValue(new Error("offline"));
    expect(
      await createSquareProvider(config, network).charge(request),
    ).toMatchObject({ ok: false, declined: false, code: "NETWORK_ERROR" });
  });

  it("refuses non-positive or fractional amounts without calling Square", async () => {
    const fetchMock = vi.fn();
    const provider = createSquareProvider(config, fetchMock);
    expect(await provider.charge({ ...request, amountCents: 0 })).toMatchObject(
      { ok: false, code: "INVALID_AMOUNT" },
    );
    expect(
      await provider.charge({ ...request, amountCents: 10.5 }),
    ).toMatchObject({ ok: false, code: "INVALID_AMOUNT" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses to run outside sandbox", () => {
    expect(() =>
      createSquareProvider({
        ...config,
        environment: "production" as "sandbox",
      }),
    ).toThrow(/sandbox/);
  });
});
