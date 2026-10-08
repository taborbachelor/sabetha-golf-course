/**
 * Apple Pay / Google Pay payment request shapes for the Square Web Payments
 * SDK. The total is only what the wallet sheet shows: the server re-prices
 * every checkout and charges its own amount, never this one.
 */

export type WalletLineItem = { amount: string; label: string };
export type WalletPaymentRequest = {
  countryCode: "US";
  currencyCode: "USD";
  total: WalletLineItem;
};

/** 1250 -> "12.50" (Square wants a decimal string). Null if not a positive whole number of cents. */
export function centsToAmount(cents: number): string | null {
  if (!Number.isSafeInteger(cents) || cents <= 0) return null;
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** The wallet total for an amount in cents, or null if there is nothing to pay. */
export function walletTotal(
  amountCents: number,
  label: string,
): WalletLineItem | null {
  const amount = centsToAmount(amountCents);
  return amount ? { amount, label: label.trim() || "Sabetha Golf Club" } : null;
}

/** Options for `payments.paymentRequest(...)`, or null if there is nothing to pay. */
export function walletPaymentRequest(
  amountCents: number,
  label: string,
): WalletPaymentRequest | null {
  const total = walletTotal(amountCents, label);
  return total ? { countryCode: "US", currencyCode: "USD", total } : null;
}
