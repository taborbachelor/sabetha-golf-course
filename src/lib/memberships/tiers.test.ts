import { describe, expect, it } from "vitest";
import { tierFromForm, tierRow } from "./tiers";

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe("tierFromForm", () => {
  it("reads a tier and stores an empty description as null", () => {
    const r = tierFromForm(
      form({ name: " Senior ", notes: " ", price: "350", sortOrder: "50" }),
    );
    expect(r.success && tierRow(r.data)).toEqual({
      name: "Senior",
      notes: null,
      price_cents: 35000,
      is_sample: false,
      sort_order: 50,
    });
  });

  it("explains a bad price", () => {
    const r = tierFromForm(
      form({ name: "Senior", price: "lots", sortOrder: "1" }),
    );
    expect(r.error?.issues[0].message).toBe("Enter the yearly dues, like 400");
  });
});
