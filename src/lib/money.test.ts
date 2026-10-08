import { describe, expect, it } from "vitest";
import { formatDollars } from "./money";

describe("formatDollars", () => {
  it("drops .00 from whole-dollar prices", () => {
    expect(formatDollars(60000)).toBe("$600");
    expect(formatDollars(0)).toBe("$0");
  });

  it("keeps cents when there are some", () => {
    expect(formatDollars(30050)).toBe("$300.50");
    expect(formatDollars(12501)).toBe("$125.01");
  });

  it("groups thousands", () => {
    expect(formatDollars(125000)).toBe("$1,250");
  });
});
