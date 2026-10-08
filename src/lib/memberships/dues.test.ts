import { describe, expect, it } from "vitest";
import { duesAmount, duesFormSchema } from "./dues";

describe("duesAmount", () => {
  it("charges the full amount or half", () => {
    expect(duesAmount(60000, "full")).toBe(60000);
    expect(duesAmount(60000, "first")).toBe(30000);
    expect(duesAmount(60000, "second")).toBe(30000);
  });

  it("splits an odd cent so the halves add up", () => {
    expect(duesAmount(25001, "first")).toBe(12500);
    expect(duesAmount(25001, "second")).toBe(12501);
  });

  it("rejects bad prices", () => {
    expect(() => duesAmount(-1, "full")).toThrow();
    expect(() => duesAmount(10.5, "full")).toThrow();
  });
});

describe("duesFormSchema", () => {
  const valid = {
    tierId: "82cce7e3-cbcb-4a6b-88be-43e5d22beb6e",
    installment: "first",
    name: " Pat Member ",
    email: "pat@example.com",
  };

  it("accepts and trims a valid form", () => {
    expect(duesFormSchema.parse(valid).name).toBe("Pat Member");
  });

  it("rejects an unknown installment or missing tier", () => {
    expect(
      duesFormSchema.safeParse({ ...valid, installment: "third" }).success,
    ).toBe(false);
    expect(duesFormSchema.safeParse({ ...valid, tierId: "" }).success).toBe(
      false,
    );
  });
});
