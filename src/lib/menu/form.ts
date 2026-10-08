import { z } from "zod";
import { parseDollars } from "@/lib/money";

/** A menu item as edited in /admin/menu. Kind "drink" means not food. */
export const menuItemSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(80),
  category: z.string().trim().min(1, "Enter a section, e.g. Drinks").max(40),
  priceCents: z.number({ error: "Enter a price like 8.25" }).int().min(0),
  isFood: z.boolean(),
  isAlcohol: z.boolean(),
  available: z.boolean(),
  isSample: z.boolean(),
  sortOrder: z.number({ error: "Enter a number" }).int().min(0).max(9999),
});

export type MenuItemInput = z.infer<typeof menuItemSchema>;

/**
 * The type a new item probably is, from the section typed for it: items
 * added under "Drinks", "Beer & seltzers" or "Bar" start as drinks (they can
 * still be ordered when the kitchen is Drinks only). The admin can change it.
 */
export function defaultKind(section: string): "food" | "drink" {
  return DRINK_SECTION.test(section) ? "drink" : "food";
}

const DRINK_SECTION =
  /\b(drinks?|beverages?|beers?|seltzers?|sodas?|pop|wines?|cocktails?|bar|coffee|tea|water)\b/i;

export function menuItemFromForm(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "");
  const on = (key: string) => formData.get(key) === "on";
  const sort = text("sortOrder").trim();
  return menuItemSchema.safeParse({
    name: text("name"),
    category: text("category"),
    priceCents: parseDollars(text("price")) ?? undefined,
    isFood: text("kind") !== "drink",
    isAlcohol: on("isAlcohol"),
    available: on("available"),
    isSample: on("isSample"),
    sortOrder: sort === "" ? undefined : Number(sort),
  });
}

/** Columns for the menu_items table. */
export function menuItemRow(item: MenuItemInput) {
  return {
    name: item.name,
    category: item.category,
    price_cents: item.priceCents,
    is_food: item.isFood,
    is_alcohol: item.isAlcohol,
    available: item.available,
    is_sample: item.isSample,
    sort_order: item.sortOrder,
  };
}
