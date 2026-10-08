import { describe, expect, it } from "vitest";
import { isWeekend } from "./dates";

describe("isWeekend", () => {
  it("is true for Saturday and Sunday", () => {
    expect(isWeekend(new Date(2026, 9, 10))).toBe(true); // Sat
    expect(isWeekend(new Date(2026, 9, 11))).toBe(true); // Sun
  });

  it("is false for weekdays", () => {
    expect(isWeekend(new Date(2026, 9, 7))).toBe(false); // Wed
    expect(isWeekend(new Date(2026, 9, 9))).toBe(false); // Fri
  });
});
