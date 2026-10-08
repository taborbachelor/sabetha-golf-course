import { describe, expect, it } from "vitest";
import { defaultSettings } from "@/content/settings";
import { editableFrom, mergeSettings } from "./editable";

describe("mergeSettings", () => {
  it("returns the defaults when the database has no rows", () => {
    expect(mergeSettings(defaultSettings, [])).toEqual(defaultSettings);
  });

  it("round-trips the defaults through the editable shape", () => {
    const rows = Object.entries(
      JSON.parse(JSON.stringify(editableFrom(defaultSettings))),
    ).map(([key, value]) => ({ key, value }));
    expect(mergeSettings(defaultSettings, rows)).toEqual(defaultSettings);
  });

  it("applies valid rows from the database (JSON keys are strings)", () => {
    const merged = mergeSettings(defaultSettings, [
      {
        key: "green_fees",
        value: {
          weekday: { "9": 22, "18": 32 },
          weekend: { "9": 27, "18": 37 },
        },
      },
      { key: "pool_guest_fee", value: 5 },
      { key: "book_ahead_days", value: 7 },
      { key: "delivery_minutes", value: { min: 5, max: 15 } },
    ]);
    expect(merged.deliveryMinutes).toEqual({ min: 5, max: 15 });
    expect(merged.greenFees.weekday[9]).toBe(22);
    expect(merged.greenFees.weekend[18]).toBe(37);
    expect(merged.pool).toEqual({ ...defaultSettings.pool, guestFee: 5 });
    expect(merged.bookAheadDays).toBe(7);
    expect(merged.cartRental).toEqual(defaultSettings.cartRental);
  });

  it("ignores invalid rows and unrelated keys", () => {
    const merged = mergeSettings(defaultSettings, [
      { key: "cart_rental", value: { "9": -5, "18": 20 } },
      { key: "pool_guest_fee", value: 4.5 },
      { key: "clubhouse_hours", value: [null, null] },
      { key: "kitchen_status", value: "closed" },
      { key: "delivery_minutes", value: { min: 20, max: 10 } },
      { key: "book_ahead_days", value: 90 },
    ]);
    expect(merged).toEqual(defaultSettings);
  });

  it("rejects hours that close before they open", () => {
    const hours = [...defaultSettings.clubhouseHours];
    hours[0] = { open: "19:00", close: "11:00" };
    const merged = mergeSettings(defaultSettings, [
      { key: "clubhouse_hours", value: hours },
    ]);
    expect(merged.clubhouseHours).toEqual(defaultSettings.clubhouseHours);
  });
});
