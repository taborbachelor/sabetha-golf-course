import { z } from "zod";
import { isIsoDate, todayIn } from "@/lib/dates";
import { MAX_PLAYERS, maxCartsFor } from "@/lib/pricing";
import { addDays, zonedTimeToUtc } from "@/lib/time";

export const ARRIVAL_CHOICES = ["now", "15", "30", "later"] as const;
export type ArrivalChoice = (typeof ARRIVAL_CHOICES)[number];

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
      .regex(/^\d{2}:\d{2}$/)
      .optional(),
    name: z.string().trim().min(2, "Enter your name").max(80),
    phone: z
      .string()
      .trim()
      .refine(
        (v) => v.replace(/\D/g, "").length >= 10,
        "Enter a 10-digit phone number",
      ),
    email: z.email("Enter a valid email").max(120),
  })
  .refine((v) => v.carts <= maxCartsFor(v.players), {
    path: ["carts"],
    message: "Up to one cart per two players",
  })
  .refine((v) => v.arrival !== "later" || !!v.arrivalTime, {
    path: ["arrivalTime"],
    message: "Pick an arrival time",
  });

export type PayForm = z.infer<typeof payFormSchema>;

/**
 * When the party arrives, as a UTC instant. "now/15/30" only make sense
 * for today; other days must pick a time. Returns an error message instead
 * of a date when the choice is invalid.
 */
export function resolveArrival(
  form: Pick<PayForm, "playDate" | "arrival" | "arrivalTime">,
  opts: { timeZone: string; bookAheadDays: number; now?: Date },
):
  { ok: true; arriveAt: Date } | { ok: false; field: string; message: string } {
  const now = opts.now ?? new Date();
  const today = todayIn(opts.timeZone, now);
  const lastDay = addDays(today, opts.bookAheadDays);

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
    return {
      ok: true,
      arriveAt: new Date(
        now.getTime() +
          Number(form.arrival === "now" ? 0 : form.arrival) * 60_000,
      ),
    };
  }

  const arriveAt = zonedTimeToUtc(
    form.playDate,
    form.arrivalTime!,
    opts.timeZone,
  );
  // Allow a few minutes of slack for "right now" picks.
  if (arriveAt.getTime() < now.getTime() - 10 * 60_000) {
    return { ok: false, field: "arrivalTime", message: "That time has passed" };
  }
  return { ok: true, arriveAt };
}
