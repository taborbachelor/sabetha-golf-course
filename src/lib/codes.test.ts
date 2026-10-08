import { describe, expect, it } from "vitest";
import { isUuid, shortCode } from "./codes";

describe("shortCode", () => {
  it("makes prefix + 4 unambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      expect(shortCode("R")).toMatch(/^R-[2-9A-HJKMNP-Z]{4}$/);
    }
  });
});

describe("isUuid", () => {
  it("accepts random UUIDs and rejects anything else", () => {
    expect(isUuid(crypto.randomUUID())).toBe(true);
    expect(isUuid("R-7K3Q")).toBe(false);
    expect(isUuid("1")).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid("615aee72-0d88-4a6f-9e85-c9f72e791779' or 1=1")).toBe(false);
  });
});
