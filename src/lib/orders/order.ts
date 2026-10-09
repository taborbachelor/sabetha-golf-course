import { z } from "zod";

export type KitchenStatus = "open" | "drinks_only" | "closed";

export type MenuRow = {
  id: string;
  name: string;
  category: string;
  price_cents: number;
  is_food: boolean;
  is_alcohol: boolean;
  available: boolean;
  is_sample: boolean;
  sort_order: number;
};

export const MAX_QTY_PER_ITEM = 10;
export const MAX_ITEMS = 30;

/** What the browser sends. Prices never come from the browser. */
export const orderSchema = z.object({
  hole: z.number().int().min(1).max(9),
  items: z
    .array(
      z.object({
        id: z.uuid(),
        qty: z.number().int().min(1).max(MAX_QTY_PER_ITEM),
      }),
    )
    .min(1, "Add something to your order"),
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z
    .string()
    .trim()
    .refine(
      (v) => v.replace(/\D/g, "").length >= 10,
      "Enter a 10-digit phone number",
    ),
});

export type OrderInput = z.infer<typeof orderSchema>;

/** Items the kitchen can make right now. */
export function orderableItems(
  menu: MenuRow[],
  kitchen: KitchenStatus,
): MenuRow[] {
  if (kitchen === "closed") return [];
  return menu
    .filter((m) => m.available && (kitchen === "open" || !m.is_food))
    .sort((a, b) => a.sort_order - b.sort_order);
}

export type OrderLine = {
  id: string;
  name: string;
  qty: number;
  price_cents: number;
  is_alcohol: boolean;
};

export type UnavailableItem = { id: string; name: string };

export type PricedOrder =
  | { ok: true; lines: OrderLine[]; totalCents: number; hasAlcohol: boolean }
  | { ok: false; message: string; unavailable?: UnavailableItem[] };

/** "A", "A and B", "A, B and C". */
function listNames(names: string[]): string {
  return names.length < 2
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

/**
 * "Hot Dog isn't available right now (kitchen closed). Remove it to continue."
 */
export function unavailableMessage(
  items: UnavailableItem[],
  kitchenClosed: boolean,
): string {
  const one = items.length === 1;
  const reason = kitchenClosed ? " (kitchen closed)" : "";
  return `${listNames(items.map((i) => i.name))} ${one ? "isn't" : "aren't"} available right now${reason}. Remove ${one ? "it" : "them"} to continue.`;
}

/**
 * Price an order from the database menu. Rejects items that don't exist or
 * aren't orderable right now (e.g. food when the kitchen is drinks-only).
 */
export function priceOrder(
  items: OrderInput["items"],
  menu: MenuRow[],
  kitchen: KitchenStatus,
): PricedOrder {
  const orderable = new Map(
    orderableItems(menu, kitchen).map((m) => [m.id, m]),
  );
  const qtyById = new Map<string, number>();
  for (const { id, qty } of items)
    qtyById.set(id, (qtyById.get(id) ?? 0) + qty);

  const total = [...qtyById.values()].reduce((a, b) => a + b, 0);
  if (total > MAX_ITEMS) {
    return { ok: false, message: `Orders are limited to ${MAX_ITEMS} items.` };
  }

  const missing = [...qtyById.keys()].filter((id) => !orderable.has(id));
  if (missing.length) {
    const byId = new Map(menu.map((m) => [m.id, m]));
    const unavailable = missing.map((id) => ({
      id,
      name: byId.get(id)?.name ?? "An item",
    }));
    // Every missing item is food the kitchen can't make right now, as
    // opposed to something staff hid or that no longer exists.
    const kitchenClosed =
      kitchen !== "open" &&
      missing.every((id) => {
        const m = byId.get(id);
        return !!m && m.available && m.is_food;
      });
    return {
      ok: false,
      message: unavailableMessage(unavailable, kitchenClosed),
      unavailable,
    };
  }

  const lines: OrderLine[] = [];
  for (const [id, qty] of qtyById) {
    const item = orderable.get(id)!;
    if (qty > MAX_QTY_PER_ITEM) {
      return { ok: false, message: `Up to ${MAX_QTY_PER_ITEM} of each item.` };
    }
    lines.push({
      id,
      name: item.name,
      qty,
      price_cents: item.price_cents,
      is_alcohol: item.is_alcohol,
    });
  }

  return {
    ok: true,
    lines,
    totalCents: lines.reduce((sum, l) => sum + l.qty * l.price_cents, 0),
    hasAlcohol: lines.some((l) => l.is_alcohol),
  };
}

export const ORDER_STEPS = [
  { status: "new", label: "Received" },
  { status: "preparing", label: "Preparing" },
  { status: "out_for_delivery", label: "On the way" },
  { status: "delivered", label: "Delivered" },
] as const;

export type OrderStatus =
  "pending" | (typeof ORDER_STEPS)[number]["status"] | "cancelled";
