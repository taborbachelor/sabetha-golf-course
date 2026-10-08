import {
  PRICES_HOURS_KEYS,
  describeProblem,
  editableSchemas,
  type EditableSettings,
  type SettingsProblem,
} from "./editable";

type PricesHoursKey = (typeof PRICES_HOURS_KEYS)[number];
export type PricesHours = Pick<EditableSettings, PricesHoursKey>;

const numberFrom = (formData: FormData) => (name: string) => {
  const raw = String(formData.get(name) ?? "").trim();
  return raw === "" ? NaN : Number(raw);
};

/**
 * Reads the /admin/settings form. Inputs are named by path, e.g.
 * "green_fees.weekday.9"; hours use "hours.<day>.open|close|closed".
 * Returns every value validated, or the first problem in plain words.
 */
export function settingsFromForm(
  formData: FormData,
): { ok: true; values: PricesHours } | ({ ok: false } & SettingsProblem) {
  const num = numberFrom(formData);
  const byHoles = (prefix: string) => ({
    9: num(`${prefix}.9`),
    18: num(`${prefix}.18`),
  });

  const raw: Record<PricesHoursKey, unknown> = {
    green_fees: {
      weekday: byHoles("green_fees.weekday"),
      weekend: byHoles("green_fees.weekend"),
    },
    cart_rental: byHoles("cart_rental"),
    clubhouse_hours: Array.from({ length: 7 }, (_, day) =>
      formData.get(`hours.${day}.closed`) === "on"
        ? null
        : {
            open: String(formData.get(`hours.${day}.open`) ?? ""),
            close: String(formData.get(`hours.${day}.close`) ?? ""),
          },
    ),
    book_ahead_days: num("book_ahead_days"),
    round_minutes: byHoles("round_minutes"),
    pool_guest_fee: num("pool_guest_fee"),
    clubhouse_rental: {
      cleanupDeposit: num("clubhouse_rental.cleanupDeposit"),
      selfCleanRefund: num("clubhouse_rental.selfCleanRefund"),
      outsideCateringFee: num("clubhouse_rental.outsideCateringFee"),
    },
  };

  const values: Record<string, unknown> = {};
  for (const key of PRICES_HOURS_KEYS) {
    const parsed = editableSchemas[key].safeParse(raw[key]);
    if (!parsed.success)
      return { ok: false, ...describeProblem(key, parsed.error) };
    values[key] = parsed.data;
  }
  return { ok: true, values: values as PricesHours };
}

/**
 * Reads the typical delivery time from the Order to the Course form:
 * inputs "delivery_minutes.min" and "delivery_minutes.max".
 */
export function deliveryFromForm(
  formData: FormData,
):
  | { ok: true; value: EditableSettings["delivery_minutes"] }
  | ({ ok: false } & SettingsProblem) {
  const num = numberFrom(formData);
  const parsed = editableSchemas.delivery_minutes.safeParse({
    min: num("delivery_minutes.min"),
    max: num("delivery_minutes.max"),
  });
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, ...describeProblem("delivery_minutes", parsed.error) };
}
