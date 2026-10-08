import { z } from "zod";

export const APPLICATION_STATUSES = [
  "submitted",
  "approved",
  "rejected",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

/** Membership application fields, as posted by the form on /memberships/apply. */
export const applicationSchema = z.object({
  tierId: z.uuid("Pick a membership type"),
  name: z.string().trim().min(2, "Enter your full name").max(120),
  address: z.string().trim().min(5, "Enter your mailing address").max(300),
  phone: z
    .string()
    .trim()
    .max(40)
    .refine(
      (v) => v.replace(/\D/g, "").length >= 10,
      "Enter a 10-digit phone number",
    ),
  email: z.email("Enter a valid email").max(120),
  cartShed: z.boolean(),
});

export type Application = z.infer<typeof applicationSchema>;

/** Reads the form fields. A checkbox posts "on" when ticked, nothing otherwise. */
export function applicationFromForm(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "");
  return {
    tierId: text("tierId"),
    name: text("name"),
    address: text("address"),
    phone: text("phone"),
    email: text("email").trim(),
    cartShed: formData.get("cartShed") === "on",
  };
}
