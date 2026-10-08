import {
  EDITABLE_KEYS,
  editableSchemas,
  type EditableSettings,
} from "./editable";

/**
 * Reads the /admin/settings form. Inputs are named by path, e.g.
 * "green_fees.weekday.9"; hours use "hours.<day>.open|close|closed".
 * Returns every value validated, or the first problem in plain words.
 */
export function settingsFromForm(
  formData: FormData,
):
  | { ok: true; values: EditableSettings }
  | { ok: false; key: string; message: string } {
  const num = (name: string) => {
    const raw = String(formData.get(name) ?? "").trim();
    return raw === "" ? NaN : Number(raw);
  };
  const byHoles = (prefix: string) => ({
    9: num(`${prefix}.9`),
    18: num(`${prefix}.18`),
  });

  const raw: Record<string, unknown> = {
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
  for (const key of EDITABLE_KEYS) {
    const parsed = editableSchemas[key].safeParse(raw[key]);
    if (!parsed.success) {
      return { ok: false, key, message: parsed.error.issues[0].message };
    }
    values[key] = parsed.data;
  }
  return { ok: true, values: values as EditableSettings };
}
