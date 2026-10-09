import { describe, expect, it } from "vitest";
import { DROPPED_MESSAGE } from "@/lib/rounds/checkout";
import {
  afterDuesChargeFailure,
  duesAmount,
  duesFormSchema,
  duesReceiptCode,
  duesSeason,
} from "./dues";

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

describe("afterDuesChargeFailure", () => {
  const failure = (over: {
    retryable: boolean;
    code: string;
    message: string;
  }) => ({ ok: false, declined: false, ...over }) as const;

  it("keeps the same checkout for a retry when the charge may have happened", () => {
    expect(
      afterDuesChargeFailure(
        failure({ retryable: true, code: "NETWORK", message: "fetch failed" }),
      ),
    ).toEqual({ message: DROPPED_MESSAGE, retrySame: true });
  });

  it("starts fresh after a definite failure", () => {
    expect(
      afterDuesChargeFailure({
        ...failure({
          retryable: false,
          code: "CARD_DECLINED",
          message: "Card declined",
        }),
        declined: true,
      }),
    ).toEqual({ message: "Card declined", retrySame: false });
  });

  it("warns instead of retrying when the checkout ID was already used", () => {
    const r = afterDuesChargeFailure(
      failure({
        retryable: false,
        code: "IDEMPOTENCY_KEY_REUSED",
        message: "x",
      }),
    );
    expect(r.retrySame).toBe(false);
    expect(r.message).toMatch(/may already have gone through/);
  });
});

describe("duesSeason", () => {
  const tz = "America/Chicago";

  it("pays the current year from January through September", () => {
    expect(duesSeason(new Date("2026-01-15T18:00:00Z"), tz)).toBe(2026);
    expect(duesSeason(new Date("2026-06-01T18:00:00Z"), tz)).toBe(2026);
    expect(duesSeason(new Date("2026-09-30T18:00:00Z"), tz)).toBe(2026);
  });

  it("pays next season from October onward", () => {
    expect(duesSeason(new Date("2026-10-01T18:00:00Z"), tz)).toBe(2027);
    expect(duesSeason(new Date("2026-12-31T18:00:00Z"), tz)).toBe(2027);
  });

  it("uses the club's date, not UTC", () => {
    // Already October 1 in UTC, still September 30 in Kansas.
    expect(duesSeason(new Date("2026-10-01T03:00:00Z"), tz)).toBe(2026);
    // Already January 1 in UTC, still December 31 in Kansas.
    expect(duesSeason(new Date("2027-01-01T03:00:00Z"), tz)).toBe(2027);
  });
});

describe("duesReceiptCode", () => {
  it("is the first 8 characters of the ID, upper-cased", () => {
    expect(duesReceiptCode("3f9a1c2b-0d4e-4f00-8a00-123456789abc")).toBe(
      "3F9A1C2B",
    );
  });

  it("is the same every time for the same ID", () => {
    const id = "00ab12cd-0000-4000-8000-000000000000";
    expect(duesReceiptCode(id)).toBe(duesReceiptCode(id));
  });
});
