import { z } from "zod";
import type { ChargeResult } from "@/lib/payments/types";
import { DROPPED_MESSAGE, afterChargeFailure } from "@/lib/rounds/checkout";

export const INSTALLMENTS = ["full", "first", "second"] as const;
export type Installment = (typeof INSTALLMENTS)[number];

/**
 * What one dues payment costs. Halves split an odd cent so the two add up
 * to the annual dues exactly (the first half rounds down).
 */
export function duesAmount(annualCents: number, installment: Installment) {
  if (!Number.isInteger(annualCents) || annualCents < 0) {
    throw new Error("Dues must be a whole number of cents");
  }
  const firstHalf = Math.floor(annualCents / 2);
  if (installment === "full") return annualCents;
  if (installment === "first") return firstHalf;
  return annualCents - firstHalf;
}

/** Dues form fields. Shared by the browser form and the server action. */
export const duesFormSchema = z.object({
  tierId: z.uuid("Pick your membership type"),
  installment: z.enum(INSTALLMENTS, "Pick what you're paying"),
  name: z.string().trim().min(2, "Enter the member's name").max(120),
  email: z.email("Enter a valid email").max(120),
});

export type DuesForm = z.infer<typeof duesFormSchema>;

/**
 * What the dues form should do after a failed charge, using the same rules
 * as Pay to Play (afterChargeFailure). When we can't tell if Square took the
 * money (network error, timeout, 5xx), the browser keeps the SAME checkout
 * ID and token and retries: Square replays the earlier result or charges
 * once now. Anything else (declined card, bad token) is final and the next
 * tap starts a fresh attempt.
 */
export function afterDuesChargeFailure(
  charge: Extract<ChargeResult, { ok: false }>,
): { message: string; retrySame: boolean } {
  switch (afterChargeFailure(charge)) {
    case "retry":
      return { message: DROPPED_MESSAGE, retrySame: true };
    case "keep":
      // This checkout ID was already used with a different request, so an
      // earlier try may have charged. Don't invite a second charge.
      return {
        message:
          "This payment may already have gone through. Please check with the Club Secretary before paying again.",
        retrySame: false,
      };
    case "cancel":
      return { message: charge.message, retrySame: false };
  }
}

/**
 * Which season a dues payment covers. Dues statements go out at the end of
 * January and are due March 1 / June 1, and the course winds down in the
 * fall, so anything paid from October onward is treated as paying ahead for
 * NEXT season; January to September pays the current year. `date` is read in
 * the club's time zone so a payment late on September 30 isn't pushed forward.
 */
export function duesSeason(date: Date, timeZone: string): number {
  const [year, month] = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  })
    .format(date)
    .split("-")
    .map(Number);
  return month >= 10 ? year + 1 : year;
}

/**
 * Short code to quote for a dues payment: the first 8 characters of its ID,
 * upper-cased ("3F9A1C2B"). Derived, so nothing extra is stored; the full ID
 * is still what opens the receipt.
 */
export function duesReceiptCode(id: string): string {
  return id.replace(/-/g, "").slice(0, 8).toUpperCase();
}
