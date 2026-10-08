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
      code: string;
      message: string;
    };

export interface PaymentsProvider {
  charge(request: ChargeRequest): Promise<ChargeResult>;
}
