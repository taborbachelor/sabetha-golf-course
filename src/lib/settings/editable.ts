import { z } from "zod";
import type { DayHours, Settings } from "@/content/settings";

/**
 * The settings admins can edit, each stored as one row in the `settings`
 * table (key -> jsonb). Anything missing or invalid in the database falls
 * back to the defaults in src/content/settings.ts, so a bad row can never
 * take the site down or zero out a price.
 */

const number = () => z.number({ error: "Enter a number" });
/** Whole dollars. The club's prices are round numbers; cents add nothing. */
const dollars = number().int("Whole dollars only").min(0).max(10000);
const byHoles = z.object({ 9: dollars, 18: dollars });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const dayHours = z
  .object({ open: time, close: time })
  .refine((d) => d.open < d.close, "Closing time must be after opening time")
  .nullable();

export const editableSchemas = {
  green_fees: z.object({ weekday: byHoles, weekend: byHoles }),
  cart_rental: byHoles,
  clubhouse_hours: z.array(dayHours).length(7),
  book_ahead_days: number().int("Whole days only").min(0).max(60),
  round_minutes: z.object({
    9: number().int("Whole minutes only").min(30).max(480),
    18: number().int("Whole minutes only").min(60).max(720),
  }),
  pool_guest_fee: dollars,
  clubhouse_rental: z.object({
    cleanupDeposit: dollars,
    selfCleanRefund: dollars,
    outsideCateringFee: dollars,
  }),
} as const;

export type EditableKey = keyof typeof editableSchemas;
export const EDITABLE_KEYS = Object.keys(editableSchemas) as EditableKey[];

export type EditableSettings = {
  [K in EditableKey]: z.infer<(typeof editableSchemas)[K]>;
};

/** The editable values as they are in a full Settings object. */
export function editableFrom(settings: Settings): EditableSettings {
  return {
    green_fees: settings.greenFees,
    cart_rental: settings.cartRental,
    clubhouse_hours: settings.clubhouseHours,
    book_ahead_days: settings.bookAheadDays,
    round_minutes: settings.roundMinutes,
    pool_guest_fee: settings.pool.guestFee,
    clubhouse_rental: settings.clubhouseRental,
  };
}

/** Defaults overlaid with every valid row from the database. */
export function mergeSettings(
  defaults: Settings,
  rows: { key: string; value: unknown }[],
): Settings {
  const e = editableFrom(defaults);
  const out = e as Record<EditableKey, unknown>;
  for (const row of rows) {
    if (!(row.key in editableSchemas)) continue;
    const key = row.key as EditableKey;
    const parsed = editableSchemas[key].safeParse(row.value);
    if (parsed.success) out[key] = parsed.data;
  }
  return {
    ...defaults,
    greenFees: e.green_fees,
    cartRental: e.cart_rental,
    clubhouseHours: e.clubhouse_hours as DayHours[],
    bookAheadDays: e.book_ahead_days,
    roundMinutes: e.round_minutes,
    pool: { ...defaults.pool, guestFee: e.pool_guest_fee },
    clubhouseRental: e.clubhouse_rental,
  };
}
