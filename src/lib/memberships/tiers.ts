import { z } from "zod";
import { parseDollars } from "@/lib/money";

export type TierRow = {
  id: string;
  name: string;
  price_cents: number;
  notes: string | null;
  sort_order: number;
  is_sample: boolean;
};

export const TIER_COLUMNS =
  "id, name, price_cents, notes, sort_order, is_sample";

/** A membership type as edited in /admin/tiers. Price is the annual dues. */
export const tierSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(60),
  notes: z.string().trim().max(200),
  priceCents: z
    .number({ error: "Enter the yearly dues, like 400" })
    .int()
    .min(0),
  isSample: z.boolean(),
  sortOrder: z.number({ error: "Enter a number" }).int().min(0).max(9999),
});

export function tierFromForm(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "");
  const sort = text("sortOrder").trim();
  return tierSchema.safeParse({
    name: text("name"),
    notes: text("notes"),
    priceCents: parseDollars(text("price")) ?? undefined,
    isSample: formData.get("isSample") === "on",
    sortOrder: sort === "" ? undefined : Number(sort),
  });
}

export function tierRow(tier: z.infer<typeof tierSchema>) {
  return {
    name: tier.name,
    notes: tier.notes || null,
    price_cents: tier.priceCents,
    is_sample: tier.isSample,
    sort_order: tier.sortOrder,
  };
}
