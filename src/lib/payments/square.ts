import type { ChargeRequest, ChargeResult, PaymentsProvider } from "./types";

export const SQUARE_SANDBOX_URL = "https://connect.squareupsandbox.com";
export const SQUARE_API_VERSION = "2025-01-23";

type SquareConfig = {
  environment: "sandbox";
  accessToken: string;
  locationId: string;
};

type SquareError = { code: string; detail?: string; category: string };

/** Square Payments API adapter (sandbox only until Phase 4). */
export function createSquareProvider(
  config: SquareConfig,
  fetchImpl: typeof fetch = fetch,
): PaymentsProvider {
  if (config.environment !== "sandbox") {
    throw new Error("Square is sandbox-only until Phase 4");
  }

  return {
    async charge(req: ChargeRequest): Promise<ChargeResult> {
      if (!Number.isInteger(req.amountCents) || req.amountCents <= 0) {
        return {
          ok: false,
          declined: false,
          code: "INVALID_AMOUNT",
          message: "Amount must be a positive whole number of cents.",
        };
      }

      let res: Response;
      try {
        res = await fetchImpl(`${SQUARE_SANDBOX_URL}/v2/payments`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            "Square-Version": SQUARE_API_VERSION,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            source_id: req.sourceToken,
            idempotency_key: req.idempotencyKey.slice(0, 45),
            amount_money: { amount: req.amountCents, currency: "USD" },
            location_id: config.locationId,
            reference_id: req.referenceId.slice(0, 40),
            note: req.note.slice(0, 500),
            autocomplete: true,
          }),
        });
      } catch {
        return {
          ok: false,
          declined: false,
          code: "NETWORK_ERROR",
          message: "Couldn't reach the payment service. Please try again.",
        };
      }

      const body = (await res.json().catch(() => ({}))) as {
        payment?: { id: string; status: string; receipt_url?: string };
        errors?: SquareError[];
      };

      if (res.ok && body.payment) {
        return {
          ok: true,
          paymentId: body.payment.id,
          status: body.payment.status,
          receiptUrl: body.payment.receipt_url,
        };
      }

      const error = body.errors?.[0];
      const declined = error?.category === "PAYMENT_METHOD_ERROR";
      return {
        ok: false,
        declined,
        code: error?.code ?? `HTTP_${res.status}`,
        message: declined
          ? "Your card was declined. Please try another card."
          : "The payment didn't go through. Please try again.",
      };
    },
  };
}
