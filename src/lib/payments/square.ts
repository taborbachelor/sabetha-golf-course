import type { ChargeRequest, ChargeResult, PaymentsProvider } from "./types";

export const SQUARE_SANDBOX_URL = "https://connect.squareupsandbox.com";
export const SQUARE_API_VERSION = "2025-01-23";

/** Stop waiting on Square after this long. The charge may still land; see `retryable`. */
export const CHARGE_TIMEOUT_MS = 20_000;

type SquareConfig = {
  environment: "sandbox";
  accessToken: string;
  locationId: string;
};

type SquareError = { code: string; detail?: string; category: string };

/**
 * True when an error reply doesn't prove the payment failed: Square's own
 * 5xx / API errors, rate limiting, a timeout, or no readable error at all.
 * A definite answer (declined card, bad or used token, bad credentials, a
 * reused idempotency key) is a 4xx with an error, and is final.
 */
export function isUncertain(status: number, error?: SquareError): boolean {
  if (status >= 500 || status === 408 || status === 429) return true;
  if (!error) return true;
  return (
    error.category === "API_ERROR" || error.category === "RATE_LIMIT_ERROR"
  );
}

/** Square Payments API adapter (sandbox only until Phase 4). */
export function createSquareProvider(
  config: SquareConfig,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = CHARGE_TIMEOUT_MS,
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
          retryable: false,
          code: "INVALID_AMOUNT",
          message: "Amount must be a positive whole number of cents.",
        };
      }

      // We can't tell whether Square took the payment. The caller retries
      // with the same idempotency key and token, so this never double-charges.
      const unknown = (code: string): ChargeResult => ({
        ok: false,
        declined: false,
        retryable: true,
        code,
        message: "Couldn't reach the payment service. Please try again.",
      });

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
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (e) {
        // Offline, DNS, reset or our timeout: the request may still have landed.
        return unknown(
          e instanceof Error && e.name === "TimeoutError"
            ? "TIMEOUT"
            : "NETWORK_ERROR",
        );
      }

      let body: {
        payment?: { id: string; status: string; receipt_url?: string };
        errors?: SquareError[];
      };
      try {
        body = await res.json();
      } catch {
        // The reply was cut off or garbled: Square may well have charged.
        return unknown(`HTTP_${res.status}`);
      }

      if (res.ok && body.payment) {
        return {
          ok: true,
          paymentId: body.payment.id,
          status: body.payment.status,
          receiptUrl: body.payment.receipt_url,
        };
      }

      const error = body.errors?.[0];
      if (isUncertain(res.status, error)) {
        return unknown(error?.code ?? `HTTP_${res.status}`);
      }
      const declined = error?.category === "PAYMENT_METHOD_ERROR";
      return {
        ok: false,
        declined,
        retryable: false,
        code: error?.code ?? `HTTP_${res.status}`,
        message: declined
          ? "Your card was declined. Please try another card."
          : "The payment didn't go through. Please try again.",
      };
    },
  };
}
