import { describe, expect, it } from "vitest";
import { defaultSettings } from "@/content/settings";
import { editableFrom } from "./editable";
import { deliveryFromForm, settingsFromForm } from "./form";

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { delivery_minutes, ...pricesHours } = editableFrom(defaultSettings);
    expect(result).toEqual({
      ok: true,
      values: JSON.parse(JSON.stringify(pricesHours)),
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

  it("names the field and the rule that failed", () => {
    const cases: [string, string, string, string][] = [
      [
        "cart_rental.9",
        "",
        "cart_rental.9",
        "Cart rental, 9 holes: enter a number",
      ],
      [
        "cart_rental.18",
        "-5",
        "cart_rental.18",
        "Cart rental, 18 holes: can't be negative",
      ],
      [
        "green_fees.weekend.18",
        "20000",
        "green_fees.weekend.18",
        "Green fees, weekend 18 holes: up to $10,000",
      ],
      [
        "pool_guest_fee",
        "4.50",
        "pool_guest_fee",
        "Guest swim fee: whole dollars only",
      ],
      [
        "book_ahead_days",
        "90",
        "book_ahead_days",
        "Days ahead golfers can pay: up to 60 days",
      ],
      [
        "book_ahead_days",
        "-1",
        "book_ahead_days",
        "Days ahead golfers can pay: can't be negative",
      ],
      [
        "round_minutes.9",
        "20",
        "round_minutes.9",
        "Cart held for 9 holes: at least 30 minutes",
      ],
      [
        "round_minutes.18",
        "800",
        "round_minutes.18",
        "Cart held for 18 holes: up to 720 minutes",
      ],
      [
        "clubhouse_rental.selfCleanRefund",
        "abc",
        "clubhouse_rental.selfCleanRefund",
        "Refund if renter cleans: enter a number",
      ],
      [
        "hours.3.close",
        "10:00",
        "hours.3.close",
        "Wednesday: closing time must be after opening time",
      ],
      [
        "hours.6.open",
        "",
        "hours.6.open",
        "Saturday opening time: enter a time, like 4:30 PM",
      ],
    ];
    for (const [name, value, field, message] of cases) {
      const f = defaultForm();
      f.set(name, value);
      expect(settingsFromForm(f), `${name}=${value}`).toMatchObject({
        ok: false,
        field,
        message,
      });
    }
  });

  it("explains bad input", () => {
    const blank = defaultForm();
    blank.set("cart_rental.9", "");
    expect(settingsFromForm(blank)).toEqual({
      ok: false,
      key: "cart_rental",
      field: "cart_rental.9",
      message: "Cart rental, 9 holes: enter a number",
    });

    const cents = defaultForm();
    cents.set("pool_guest_fee", "4.50");
    expect(settingsFromForm(cents)).toMatchObject({
      ok: false,
      key: "pool_guest_fee",
      message: "Guest swim fee: whole dollars only",
    });

    const backwards = defaultForm();
    backwards.set("hours.6.close", "10:00");
    expect(settingsFromForm(backwards)).toMatchObject({
      ok: false,
      key: "clubhouse_hours",
      message: "Saturday: closing time must be after opening time",
    });
  });
});

describe("deliveryFromForm", () => {
  const form = (min: string, max: string) => {
    const f = new FormData();
    f.set("delivery_minutes.min", min);
    f.set("delivery_minutes.max", max);
    return f;
  };

  it("reads a range of minutes", () => {
    expect(deliveryFromForm(form("10", " 20 "))).toEqual({
      ok: true,
      value: { min: 10, max: 20 },
    });
    expect(deliveryFromForm(form("15", "15"))).toMatchObject({ ok: true });
  });

  it("names the box that's wrong", () => {
    expect(deliveryFromForm(form("0", "20"))).toEqual({
      ok: false,
      key: "delivery_minutes",
      field: "delivery_minutes.min",
      message: "Delivery time, shortest: at least 1 minute",
    });
    expect(deliveryFromForm(form("10", "121"))).toMatchObject({
      field: "delivery_minutes.max",
      message: "Delivery time, longest: up to 120 minutes",
    });
    expect(deliveryFromForm(form("20", "10"))).toMatchObject({
      field: "delivery_minutes.max",
      message:
        "Delivery time, longest: can't be shorter than the shortest time",
    });
    expect(deliveryFromForm(form("", "10"))).toMatchObject({
      message: "Delivery time, shortest: enter a number",
    });
  });
});
