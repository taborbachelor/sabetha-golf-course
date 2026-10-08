import { describe, expect, it } from "vitest";
import { defaultSettings } from "@/content/settings";
import { editableFrom } from "./editable";
import { settingsFromForm } from "./form";

/** The form as the admin page renders it for the defaults. */
function defaultForm() {
  const f = new FormData();
  const e = editableFrom(defaultSettings);
  for (const h of [9, 18] as const) {
    f.set(`green_fees.weekday.${h}`, String(e.green_fees.weekday[h]));
    f.set(`green_fees.weekend.${h}`, String(e.green_fees.weekend[h]));
    f.set(`cart_rental.${h}`, String(e.cart_rental[h]));
    f.set(`round_minutes.${h}`, String(e.round_minutes[h]));
  }
  e.clubhouse_hours.forEach((d, day) => {
    if (d) {
      f.set(`hours.${day}.open`, d.open);
      f.set(`hours.${day}.close`, d.close);
    } else {
      f.set(`hours.${day}.closed`, "on");
    }
  });
  f.set("book_ahead_days", String(e.book_ahead_days));
  f.set("pool_guest_fee", String(e.pool_guest_fee));
  for (const [k, v] of Object.entries(e.clubhouse_rental)) {
    f.set(`clubhouse_rental.${k}`, String(v));
  }
  return f;
}

describe("settingsFromForm", () => {
  it("reads back the defaults unchanged", () => {
    const result = settingsFromForm(defaultForm());
    expect(result).toEqual({
      ok: true,
      values: JSON.parse(JSON.stringify(editableFrom(defaultSettings))),
    });
  });

  it("applies an edited price and a newly closed day", () => {
    const f = defaultForm();
    f.set("green_fees.weekday.9", "22");
    f.set("hours.0.closed", "on");
    const result = settingsFromForm(f);
    expect(result.ok && result.values.green_fees.weekday[9]).toBe(22);
    expect(result.ok && result.values.clubhouse_hours[0]).toBeNull();
  });

  it("explains bad input", () => {
    const blank = defaultForm();
    blank.set("cart_rental.9", "");
    expect(settingsFromForm(blank)).toEqual({
      ok: false,
      key: "cart_rental",
      message: "Enter a number",
    });

    const cents = defaultForm();
    cents.set("pool_guest_fee", "4.50");
    expect(settingsFromForm(cents)).toMatchObject({
      ok: false,
      key: "pool_guest_fee",
      message: "Whole dollars only",
    });

    const backwards = defaultForm();
    backwards.set("hours.6.close", "10:00");
    expect(settingsFromForm(backwards)).toMatchObject({
      ok: false,
      key: "clubhouse_hours",
      message: "Closing time must be after opening time",
    });
  });
});
