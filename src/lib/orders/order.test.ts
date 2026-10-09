import { describe, expect, it } from "vitest";
import { orderSchema, orderableItems, priceOrder, type MenuRow } from "./order";

const row = (over: Partial<MenuRow>): MenuRow => ({
  id: crypto.randomUUID(),
  name: "Item",
  category: "Lunch",
  price_cents: 500,
  is_food: true,
  is_alcohol: false,
  available: true,
  is_sample: false,
  sort_order: 0,
  ...over,
});

const burger = row({ name: "Cheeseburger", price_cents: 995, sort_order: 30 });
const water = row({
  name: "Water",
  category: "Drinks",
  price_cents: 150,
  is_food: false,
  sort_order: 50,
});
const beer = row({
  name: "Beer",
  category: "Drinks",
  price_cents: 400,
  is_food: false,
  is_alcohol: true,
  sort_order: 53,
});
const gone = row({ name: "Gone", available: false });
const menu = [beer, burger, water, gone];

describe("orderableItems", () => {
  it("offers everything available when the kitchen is open, in menu order", () => {
    expect(orderableItems(menu, "open").map((m) => m.name)).toEqual([
      "Cheeseburger",
      "Water",
      "Beer",
    ]);
  });
  it("offers only drinks when drinks-only, and nothing when closed", () => {
    expect(orderableItems(menu, "drinks_only").map((m) => m.name)).toEqual([
      "Water",
      "Beer",
    ]);
    expect(orderableItems(menu, "closed")).toEqual([]);
  });
});

describe("priceOrder", () => {
  it("prices from the menu, merges duplicate lines and flags alcohol", () => {
    const r = priceOrder(
      [
        { id: burger.id, qty: 1 },
        { id: beer.id, qty: 2 },
        { id: beer.id, qty: 1 },
      ],
      menu,
      "open",
    );
    expect(r).toMatchObject({
      ok: true,
      totalCents: 995 + 3 * 400,
      hasAlcohol: true,
    });
    if (r.ok) expect(r.lines.find((l) => l.name === "Beer")?.qty).toBe(3);
  });

  it("rejects food when drinks-only, unknown or unavailable items, and huge orders", () => {
    expect(
      priceOrder([{ id: burger.id, qty: 1 }], menu, "drinks_only").ok,
    ).toBe(false);
    expect(priceOrder([{ id: gone.id, qty: 1 }], menu, "open").ok).toBe(false);
    expect(
      priceOrder([{ id: crypto.randomUUID(), qty: 1 }], menu, "open").ok,
    ).toBe(false);
    expect(
      priceOrder(
        [
          { id: water.id, qty: 10 },
          { id: water.id, qty: 1 },
        ],
        menu,
        "open",
      ).ok,
    ).toBe(false);
  });

  it("names food the kitchen can't make when it's drinks only", () => {
    const r = priceOrder(
      [
        { id: burger.id, qty: 1 },
        { id: water.id, qty: 1 },
      ],
      menu,
      "drinks_only",
    );
    expect(r).toEqual({
      ok: false,
      message:
        "Cheeseburger isn't available right now (kitchen closed). Remove it to continue.",
      unavailable: [{ id: burger.id, name: "Cheeseburger" }],
    });
  });

  it("names every unavailable item, hidden or unknown, without blaming the kitchen", () => {
    const ghost = crypto.randomUUID();
    const r = priceOrder(
      [
        { id: gone.id, qty: 1 },
        { id: burger.id, qty: 1 },
        { id: ghost, qty: 1 },
      ],
      menu,
      "drinks_only",
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.message).toBe(
      "Gone, Cheeseburger and An item aren't available right now. Remove them to continue.",
    );
    expect(r.unavailable?.map((u) => u.id)).toEqual([
      gone.id,
      burger.id,
      ghost,
    ]);
  });

  it("allows up to 30 items in total", () => {
    const soda = row({ name: "Soda", is_food: false });
    const bigMenu = [...menu, soda];
    const thirty = [water, beer, burger].map((m) => ({ id: m.id, qty: 10 }));
    expect(priceOrder(thirty, bigMenu, "open").ok).toBe(true);
    expect(
      priceOrder([...thirty, { id: soda.id, qty: 1 }], bigMenu, "open").ok,
    ).toBe(false);
  });
});

describe("orderSchema", () => {
  const valid = {
    hole: 5,
    items: [{ id: water.id, qty: 2 }],
    name: "Pat",
    phone: "785-555-0100",
  };
  it("accepts a valid order and rejects bad holes, empty orders and quantities", () => {
    expect(orderSchema.safeParse(valid).success).toBe(true);
    expect(orderSchema.safeParse({ ...valid, hole: 10 }).success).toBe(false);
    expect(orderSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    expect(
      orderSchema.safeParse({ ...valid, items: [{ id: water.id, qty: 0 }] })
        .success,
    ).toBe(false);
    expect(
      orderSchema.safeParse({ ...valid, items: [{ id: "x", qty: 1 }] }).success,
    ).toBe(false);
  });
});
