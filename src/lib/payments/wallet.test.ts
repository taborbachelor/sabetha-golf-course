import { describe, expect, it } from "vitest";
import { centsToAmount, walletPaymentRequest, walletTotal } from "./wallet";

describe("centsToAmount", () => {
  it("formats cents as a two-decimal string", () => {
    expect(centsToAmount(1250)).toBe("12.50");
    expect(centsToAmount(5)).toBe("0.05");
    expect(centsToAmount(100)).toBe("1.00");
    expect(centsToAmount(123456)).toBe("1234.56");
  });

  it("rejects zero, negative and fractional amounts", () => {
    expect(centsToAmount(0)).toBeNull();
    expect(centsToAmount(-100)).toBeNull();
    expect(centsToAmount(12.5)).toBeNull();
    expect(centsToAmount(Number.NaN)).toBeNull();
  });
});

describe("walletTotal", () => {
  it("uses the label, falling back to the club name", () => {
    expect(walletTotal(4400, "Green fees")).toEqual({
      amount: "44.00",
      label: "Green fees",
    });
    expect(walletTotal(4400, "  ")).toEqual({
      amount: "44.00",
      label: "Sabetha Golf Club",
    });
  });

  it("is null when there is nothing to pay", () => {
    expect(walletTotal(0, "Order")).toBeNull();
  });
});

describe("walletPaymentRequest", () => {
  it("builds a US / USD request", () => {
    expect(walletPaymentRequest(2575, "Order to the Course")).toEqual({
      countryCode: "US",
      currencyCode: "USD",
      total: { amount: "25.75", label: "Order to the Course" },
    });
  });

  it("is null for an invalid amount", () => {
    expect(walletPaymentRequest(-1, "x")).toBeNull();
  });
});
