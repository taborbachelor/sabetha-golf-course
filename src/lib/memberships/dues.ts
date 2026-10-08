import { z } from "zod";

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
