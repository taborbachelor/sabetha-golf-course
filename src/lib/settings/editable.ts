import { z } from "zod";
import type { DayHours, Settings } from "@/content/settings";

/**
 * The settings admins can edit, each stored as one row in the `settings`
 * table (key -> jsonb). Anything missing or invalid in the database falls
 * back to the defaults in src/content/settings.ts, so a bad row can never
 * take the site down or zero out a price.
 */

/**
 * A whole number between min and max. Every rule has its own message: in
 * zod 4 a schema-level `error` would also replace the min/max messages, so
 * -5 would wrongly say "Enter a number".
 */
const whole = (
  unit: "dollars" | "days" | "minutes",
  min: number,
  max: number,
) => {
  const amount = (n: number) =>
    unit === "dollars"
      ? `$${n.toLocaleString("en-US")}`
      : `${n} ${n === 1 ? unit.slice(0, -1) : unit}`;
  return z
    .number({
      error: (issue) =>
        issue.code === "invalid_type" ? "Enter a number" : undefined,
    })
    .int(`Whole ${unit} only`)
    .min(min, min === 0 ? "Can't be negative" : `At least ${amount(min)}`)
    .max(max, `Up to ${amount(max)}`);
};

/** Whole dollars. The club's prices are round numbers; cents add nothing. */
const dollars = whole("dollars", 0, 10000);
const byHoles = z.object({ 9: dollars, 18: dollars });
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time, like 4:30 PM");
const dayHours = z
  .object({ open: time, close: time })
  .refine((d) => d.open < d.close, "Closing time must be after opening time")
  .nullable();

export const editableSchemas = {
  green_fees: z.object({ weekday: byHoles, weekend: byHoles }),
  cart_rental: byHoles,
  clubhouse_hours: z.array(dayHours).length(7),
  book_ahead_days: whole("days", 0, 60),
  round_minutes: z.object({
    9: whole("minutes", 30, 480),
    18: whole("minutes", 60, 720),
  }),
  pool_guest_fee: dollars,
  clubhouse_rental: z.object({
    cleanupDeposit: dollars,
    selfCleanRefund: dollars,
    outsideCateringFee: dollars,
  }),
  /** Typical Order to the Course delivery time, e.g. 10 to 20 minutes. */
  delivery_minutes: z
    .object({ min: whole("minutes", 1, 120), max: whole("minutes", 1, 120) })
    .refine((d) => d.max >= d.min, {
      message: "Can't be shorter than the shortest time",
      path: ["max"],
    }),
} as const;

export type EditableKey = keyof typeof editableSchemas;
export const EDITABLE_KEYS = Object.keys(editableSchemas) as EditableKey[];

/** Keys saved by the Prices & hours form (the rest have their own forms). */
export const PRICES_HOURS_KEYS = EDITABLE_KEYS.filter(
  (key): key is Exclude<EditableKey, "delivery_minutes"> =>
    key !== "delivery_minutes",
);

export type EditableSettings = {
  [K in EditableKey]: z.infer<(typeof editableSchemas)[K]>;
};

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const holes = (h: PropertyKey) => `${String(h)} holes`;

/** Field names as the admin sees them, by settings key and issue path. */
const fieldLabels: Record<EditableKey, (path: PropertyKey[]) => string> = {
  green_fees: ([day, h]) => `Green fees, ${String(day)} ${holes(h)}`,
  cart_rental: ([h]) => `Cart rental, ${holes(h)}`,
  clubhouse_hours: ([day, end]) =>
    `${DAYS[Number(day)] ?? "Clubhouse hours"}${
      end === "open" ? " opening time" : end === "close" ? " closing time" : ""
    }`,
  book_ahead_days: () => "Days ahead golfers can pay",
  round_minutes: ([h]) => `Cart held for ${holes(h)}`,
  pool_guest_fee: () => "Guest swim fee",
  clubhouse_rental: ([k]) =>
    ({
      cleanupDeposit: "Cleanup deposit",
      selfCleanRefund: "Refund if renter cleans",
      outsideCateringFee: "Outside catering fee",
    })[String(k)] ?? "Clubhouse rental",
  delivery_minutes: ([end]) =>
    end === "min"
      ? "Delivery time, shortest"
      : end === "max"
        ? "Delivery time, longest"
        : "Delivery time",
};

/**
 * The form input an issue belongs to (inputs are named by path, see
 * ./form.ts), so the page can focus it. Hours that close before they open
 * point at the closing time.
 */
function fieldName(key: EditableKey, path: PropertyKey[]): string {
  if (key === "clubhouse_hours") {
    const [day, end] = path;
    return day === undefined
      ? "hours.0.open"
      : `hours.${String(day)}.${String(end ?? "close")}`;
  }
  return [key, ...path.map(String)].join(".");
}

export type SettingsProblem = {
  key: EditableKey;
  /** Name of the input to focus, e.g. "cart_rental.18". */
  field: string;
  /** Plain words naming the field, e.g. "Cart rental, 18 holes: can't be negative". */
  message: string;
};

/** The first problem with a value, named for the admin. */
export function describeProblem(
  key: EditableKey,
  error: z.ZodError,
): SettingsProblem {
  const issue = error.issues[0];
  const path = issue.path;
  const message =
    issue.message.charAt(0).toLowerCase() + issue.message.slice(1);
  return {
    key,
    field: fieldName(key, path),
    message: `${fieldLabels[key](path)}: ${message}`,
  };
}

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
    delivery_minutes: settings.deliveryMinutes,
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
    deliveryMinutes: e.delivery_minutes,
  };
}
