import { describe, expect, it } from "vitest";
import { formatPrice, menuSections } from "./menu";

describe("menu", () => {
  it("formats cents as dollars", () => {
    expect(formatPrice(200)).toBe("$2.00");
    expect(formatPrice(1125)).toBe("$11.25");
  });

  it("has every item from the printed menu", () => {
    const count = menuSections.reduce((n, s) => n + s.items.length, 0);
    expect(count).toBe(19);
  });
});
