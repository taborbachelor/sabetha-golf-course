import { z } from "zod";
import type { DayHours } from "@/content/settings";
import { dayOfWeek, isIsoDate, todayIn } from "@/lib/dates";
import { MAX_PLAYERS, maxCartsFor } from "@/lib/pricing";
import { addDays, zonedTimeToUtc } from "@/lib/time";

export const ARRIVAL_CHOICES = ["now", "15", "30", "later"] as const;
export type ArrivalChoice = (typeof ARRIVAL_CHOICES)[number];

const emailFormat = z.email();

/** Pay to Play form fields. Shared by the browser form and the server action. */
export const payFormSchema = z
  .object({
    playDate: z.string().refine(isIsoDate, "Pick a date"),
    holes: z.union([z.literal(9), z.literal(18)]),
    players: z.number().int().min(1).max(MAX_PLAYERS),
    carts: z.number().int().min(0),
    arrival: z.enum(ARRIVAL_CHOICES),
    arrivalTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, "Pick a time")
      .optional(),
    name: z.string().trim().min(2, "Enter your name").max(80),
    phone: z
      .string()
      .trim()
      .refine(
        (v) => v.replace(/\D/g, "").length >= 10,
        "Enter a 10-digit phone number",
      ),
    // Optional: there's no email sending, so it's only for the club's records.
    // Empty is stored as "" (rounds.email is NOT NULL).
    email: z
      .string()
      .trim()
      .max(120, "Enter a valid email")
      .refine(
        (v) => v === "" || emailFormat.safeParse(v).success,
        "Enter a valid email, or leave it blank",
      ),
  })
  .refine((v) => v.carts <= maxCartsFor(v.players), {
    path: ["carts"],
    message: "Up to one cart per two players",
  })
  // A held cart needs a time; a walking golfer paying ahead can leave it blank.
  .refine((v) => v.arrival !== "later" || !!v.arrivalTime || v.carts === 0, {
    path: ["arrivalTime"],
    message: "Pick a time so we can hold your cart",
  });

export type PayForm = z.infer<typeof payFormSchema>;

/** Stored as the arrival label when a walking golfer paying ahead leaves the time blank. */
export const ANY_TIME_LABEL = "Any time";

/**
 * When the party arrives, as a UTC instant. "now/15/30" only make sense
 * for today. Another day takes a time, which may be left blank when no cart
 * is held: the round is then filed at the clubhouse opening time that day
 * (noon if it's closed) and labelled "Any time". Returns an error message
 * for a field instead of a date when the choice is invalid.
 */
export function resolveArrival(
  form: Pick<PayForm, "playDate" | "arrival" | "arrivalTime"> & {
    carts?: number;
  },
  opts: {
    timeZone: string;
    bookAheadDays: number;
    clubhouseHours: DayHours[];
    now?: Date;
  },
):
  | { ok: true; arriveAt: Date; anyTime: boolean }
  | { ok: false; field: string; message: string } {
  const now = opts.now ?? new Date();
  const today = todayIn(opts.timeZone, now);
  const lastDay = addDays(today, opts.bookAheadDays);

  if (!isIsoDate(form.playDate)) {
    return { ok: false, field: "playDate", message: "Pick a date" };
  }
  if (form.playDate < today) {
    return { ok: false, field: "playDate", message: "That date has passed" };
  }
  if (form.playDate > lastDay) {
    return {
      ok: false,
      field: "playDate",
      message: `You can pay up to ${opts.bookAheadDays} days ahead`,
    };
  }

  if (form.arrival !== "later") {
    if (form.playDate !== today) {
      return { ok: false, field: "arrival", message: "Pick an arrival time" };
    }
    const arriveAt = new Date(
      now.getTime() +
        Number(form.arrival === "now" ? 0 : form.arrival) * 60_000,
    );
    // "~30 min" at 11:45pm would be tomorrow; the round is for today.
    if (todayIn(opts.timeZone, arriveAt) !== form.playDate) {
      return {
        ok: false,
        field: "arrival",
        message: "That's after midnight. Pick tomorrow's date instead.",
      };
    }
    return { ok: true, arriveAt, anyTime: false };
  }

  if (!form.arrivalTime) {
    // Today the golfer picked "Pick a time", so they owe us one.
    if (form.playDate === today) {
      return {
        ok: false,
        field: "arrivalTime",
        message: "Pick an arrival time",
      };
    }
    if ((form.carts ?? 0) > 0) {
      return {
        ok: false,
        field: "arrivalTime",
        message: "Pick a time so we can hold your cart",
      };
    }
    const hours = opts.clubhouseHours[dayOfWeek(form.playDate)];
    return {
      ok: true,
      arriveAt: zonedTimeToUtc(
        form.playDate,
        hours?.open ?? "12:00",
        opts.timeZone,
      ),
      anyTime: true,
    };
  }

  const arriveAt = zonedTimeToUtc(
    form.playDate,
    form.arrivalTime,
    opts.timeZone,
  );
  // Allow a few minutes of slack for "right now" picks.
  if (arriveAt.getTime() < now.getTime() - 10 * 60_000) {
    return { ok: false, field: "arrivalTime", message: "That time has passed" };
  }
  return { ok: true, arriveAt, anyTime: false };
}
