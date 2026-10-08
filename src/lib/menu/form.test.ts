import { describe, expect, it } from "vitest";
import type { MenuRow } from "@/lib/orders/order";
import { parseDollars } from "@/lib/money";
import { menuItemFromForm } from "./form";
import { groupMenu } from "./group";

describe("parseDollars", () => {
  it("reads common ways of typing a price", () => {
    expect(parseDollars("8.25")).toBe(825);
    expect(parseDollars("$8.25")).toBe(825);
    expect(parseDollars(" 8 ")).toBe(800);
    expect(parseDollars("8.5")).toBe(850);
    expect(parseDollars("0")).toBe(0);
  });

  it("rejects anything else", () => {
    for (const bad of ["", "abc", "8.255", "-1", "1,000", "12345"]) {
      expect(parseDollars(bad)).toBeNull();
    }
  });
});

describe("menuItemFromForm", () => {
  const form = (fields: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.set(k, v);
    return f;
  };
  const base = {
    name: " Lemonade ",
    category: "Drinks",
    price: "2.50",
    kind: "drink",
    available: "on",
    sortOrder: "55",
  };

  it("reads a drink with checkboxes", () => {
    const r = menuItemFromForm(form(base));
    expect(r.success && r.data).toEqual({
      name: "Lemonade",
      category: "Drinks",
      priceCents: 250,
      isFood: false,
      isAlcohol: false,
      available: true,
      isSample: false,
      sortOrder: 55,
    });
  });

  it("explains a bad price or missing name", () => {
    const price = menuItemFromForm(form({ ...base, price: "two" }));
    expect(price.error?.issues[0].message).toBe("Enter a price like 8.25");
    const name = menuItemFromForm(form({ ...base, name: "  " }));
    expect(name.error?.issues[0].message).toBe("Enter a name");
  });
});

describe("groupMenu", () => {
  const row = (name: string, category: string, sort: number): MenuRow => ({
    id: name,
    name,
    category,
    price_cents: 100,
    is_food: true,
    is_alcohol: false,
    available: true,
    is_sample: false,
    sort_order: sort,
  });

  it("orders sections by their first item and items by sort order", () => {
    const groups = groupMenu([
      row("Soda", "Drinks", 50),
      row("Hot Dog", "Lunch", 12),
      row("Water", "Drinks", 49),
      row("Burger", "Lunch", 11),
    ]);
    expect(groups.map((g) => [g.category, g.items.map((i) => i.name)])).toEqual(
      [
        ["Lunch", ["Burger", "Hot Dog"]],
        ["Drinks", ["Water", "Soda"]],
      ],
    );
  });
});
