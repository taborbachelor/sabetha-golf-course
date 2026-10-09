import type { ChargeRequest, ChargeResult } from "@/lib/payments/types";

/**
 * Pay to Play checkout rules, kept pure so every path is unit-tested.
 *
 * A checkout is one round row (id = the browser's checkout ID) that goes
 * pending -> paid, or pending -> cancelled. The browser keeps the checkout
 * ID and card token until it gets a definite answer, so a retry after a
 * dropped connection replays the same Square request (same idempotency key,
 * same token, same amount and note) and Square either returns the payment it
 * already took or charges once now.
 */

/**
 * A pending round older than this is treated as abandoned: the server died
 * (or the golfer walked away) between holding carts and charging. Its carts
 * go back to online inventory and its receipt says it didn't finish.
 */
export const PENDING_HOLD_MINUTES = 10;

export function isAbandoned(
  round: { status: string; created_at: string },
  now: Date = new Date(),
): boolean {
  return (
    round.status === "pending" &&
    now.getTime() - new Date(round.created_at).getTime() >
      PENDING_HOLD_MINUTES * 60_000
  );
}

/**
 * What an unpaid receipt can honestly say.
 * - "unfinished": pending past the hold window. The server may have died
 *   after Square charged and before we recorded it, so we can't say whether
 *   the card was charged.
 * - "confirming": pending within the hold window (a payment in progress).
 * - "failed": cancelled or refunded. A round is only cancelled after a
 *   definite failure, so the card wasn't charged for it.
 */
export function unpaidReceiptState(
  round: { status: string; created_at: string },
  now: Date = new Date(),
): "unfinished" | "confirming" | "failed" {
  if (round.status !== "pending") return "failed";
  return isAbandoned(round, now) ? "unfinished" : "confirming";
}

/**
 * After a charge fails: cancel the round (release its carts, start a fresh
 * attempt next time) only when Square definitely didn't take the money.
 * - retryable (network error, timeout, 5xx): the charge may have happened,
 *   so keep the round and its carts for a retry with the same key.
 * - IDEMPOTENCY_KEY_REUSED: this key was already used with a different
 *   request, so an earlier attempt may have been charged. Never cancel that
 *   round; it ages out after PENDING_HOLD_MINUTES if nothing was charged.
 * - anything else (declined card, bad token): final, so cancel.
 */
export function afterChargeFailure(
  charge: Extract<ChargeResult, { ok: false }>,
): "retry" | "keep" | "cancel" {
  if (charge.retryable) return "retry";
  if (charge.code === "IDEMPOTENCY_KEY_REUSED") return "keep";
  return "cancel";
}

export type StoredRound = {
  id: string;
  code: string;
  play_date: string;
  holes: number;
  players: number;
  carts: number;
  amount_cents: number;
};

/**
 * The Square request for a round, built only from what was stored when the
 * round was created. A retry must send exactly the same request, or Square
 * rejects the reused idempotency key instead of replaying the charge.
 */
export function chargeRequestFor(
  round: StoredRound,
  sourceToken: string,
): ChargeRequest {
  return {
    sourceToken,
    amountCents: round.amount_cents,
    idempotencyKey: round.id,
    referenceId: round.code,
    note: `${round.code}: ${round.players} × ${round.holes} holes, ${round.carts} cart(s), ${round.play_date}`,
  };
}

/** Shown when a payment may or may not have gone through. */
export const DROPPED_MESSAGE =
  "Connection dropped. Tap Pay again — you won't be charged twice.";
