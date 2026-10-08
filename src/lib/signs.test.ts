import { describe, expect, it } from "vitest";
import { qrSvg, signUrls } from "./signs";

describe("signs", () => {
  it("points at the right pages", () => {
    const u = signUrls("https://example.com");
    expect(u.pay).toBe("https://example.com/pay");
    expect(u.order).toBe("https://example.com/order");
    expect(u.hole(5)).toBe("https://example.com/order?hole=5");
  });

  it("makes the same SVG for the same URL", async () => {
    const svg = await qrSvg("https://example.com/order?hole=5");
    expect(svg).toMatch(/^<svg/);
    expect(await qrSvg("https://example.com/order?hole=5")).toBe(svg);
    expect(await qrSvg("https://example.com/order?hole=6")).not.toBe(svg);
  });
});
