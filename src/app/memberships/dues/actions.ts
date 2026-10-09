"use server";

import { formatPrice } from "@/content/menu";
import { isUuid } from "@/lib/codes";
import {
  afterDuesChargeFailure,
  duesAmount,
  duesFormSchema,
  type DuesForm,
} from "@/lib/memberships/dues";
import { getPayments } from "@/lib/payments";
import type { ChargeResult } from "@/lib/payments/types";
import { DROPPED_MESSAGE } from "@/lib/rounds/checkout";
import { createAdminClient } from "@/lib/supabase/admin";

export type DuesResult =
  | { ok: true; receiptId: string }
  | {
      ok: false;
      message: string;
      field?: keyof DuesForm;
      /**
       * The card may have been charged (dropped connection, or charged but
       * not saved): retry with the same checkout ID, token and form values.
       */
      retrySame?: boolean;
    };

const installmentNote = {
  full: "in full",
  first: "1st half",
  second: "2nd half",
};

/**
 * Pay membership dues. The amount comes from the tier's price in the
 * database; the browser only sends the form, a one-time card token and a
 * checkout ID (a UUID kept for retries, so a double-tap never charges twice).
 * The payment is recorded only after the charge succeeds.
 */
export async function payDues(
  checkoutId: string,
  input: unknown,
  sourceToken: string,
): Promise<DuesResult> {
  const fail = (message: string, extra: Partial<DuesResult> = {}) =>
    ({ ok: false, message, ...extra }) as DuesResult;

  if (!isUuid(checkoutId) || typeof sourceToken !== "string" || !sourceToken) {
    return fail("Something went wrong. Please refresh the page and try again.");
  }

  const parsed = duesFormSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(issue.message, { field: issue.path[0] as keyof DuesForm });
  }
  const form = parsed.data;
  const db = createAdminClient();

  const existing = await db
    .from("dues_payments")
    .select("id")
    .eq("id", checkoutId)
    .maybeSingle();
  // An earlier try of this checkout may have charged: keep it for a retry
  // (replaying the same checkout is always safe).
  const retry = () => fail(DROPPED_MESSAGE, { retrySame: true });
  if (existing.error) return retry();
  if (existing.data) return { ok: true, receiptId: checkoutId };

  const tier = await db
    .from("membership_tiers")
    .select("name, price_cents")
    .eq("id", form.tierId)
    .maybeSingle();
  if (tier.error) return retry();
  if (!tier.data) return fail("Pick your membership type", { field: "tierId" });

  const amountCents = duesAmount(tier.data.price_cents, form.installment);
  if (amountCents <= 0) {
    return fail(
      "Dues for this membership type aren't set yet. Please contact the Club Secretary.",
      { field: "tierId" },
    );
  }

  // A retry sends exactly the same request (same form values, token and
  // key), so Square replays the earlier charge instead of rejecting it.
  let charge: ChargeResult;
  try {
    charge = await getPayments().charge({
      sourceToken,
      amountCents,
      idempotencyKey: checkoutId,
      referenceId: checkoutId,
      note: `Dues ${installmentNote[form.installment]}: ${tier.data.name}, ${form.name} (${form.email}), ${formatPrice(amountCents)}`.slice(
        0,
        500,
      ),
    });
  } catch {
    return retry();
  }
  if (!charge.ok) {
    const { message, retrySame } = afterDuesChargeFailure(charge);
    return fail(message, { retrySame });
  }

  const { error } = await db.from("dues_payments").insert({
    id: checkoutId,
    member_name: form.name,
    email: form.email,
    tier_id: form.tierId,
    installment: form.installment,
    amount_cents: amountCents,
    payment_id: charge.paymentId,
  });
  // 23505: an earlier retry already saved it.
  if (error && error.code !== "23505") {
    return fail(
      "Your card was charged but we couldn't save the payment. Tap Pay again to finish; you won't be charged twice.",
      { retrySame: true },
    );
  }

  return { ok: true, receiptId: checkoutId };
}
