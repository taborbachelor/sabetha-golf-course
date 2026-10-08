/** Provider-neutral payment types. Swapping Square for Stripe only touches src/lib/payments. */

export type ChargeRequest = {
  /** One-time token from the browser card form (Square: source_id/nonce). */
  sourceToken: string;
  amountCents: number;
  /** Same key = same charge; retrying never double-charges. */
  idempotencyKey: string;
  /** Our order/round ID, so the payment can be matched in the provider dashboard. */
  referenceId: string;
  note: string;
};

export type ChargeResult =
  | { ok: true; paymentId: string; status: string; receiptUrl?: string }
  | {
      ok: false;
      /** True when the card was refused (show "try another card"), false for system errors. */
      declined: boolean;
      /**
       * True when we can't tell whether the charge happened (network error,
       * timeout, a 5xx or an unreadable reply). Don't give up on the
       * checkout: retry with the SAME idempotency key and source token, and
       * the provider either replays the earlier result or charges once now.
       */
      retryable: boolean;
      code: string;
      message: string;
    };

export interface PaymentsProvider {
  charge(request: ChargeRequest): Promise<ChargeResult>;
}
