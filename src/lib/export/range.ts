import { isIsoDate } from "@/lib/dates";
import { addDays } from "@/lib/time";
import type { DateRange } from "./reports";

/**
 * The dates the export form starts with, for `today` ("YYYY-MM-DD", club
 * time): this month so far, or all of last month during the first week of
 * a month, when the admin is most likely closing out the month before.
 */
export function defaultExportRange(today: string): DateRange {
  const monthStart = `${today.slice(0, 8)}01`;
  if (Number(today.slice(8)) > 7) return { from: monthStart, to: today };
  const lastMonthEnd = addDays(monthStart, -1);
  return { from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd };
}

/** A range from the query string, or why it can't be used. */
export function parseExportRange(
  from: string | null,
  to: string | null,
  today: string,
): { ok: true; range: DateRange } | { ok: false; message: string } {
  const fallback = defaultExportRange(today);
  const range = { from: from || fallback.from, to: to || fallback.to };
  if (!isIsoDate(range.from) || !isIsoDate(range.to)) {
    return { ok: false, message: "Pick both dates from the calendar." };
  }
  if (range.from > range.to) {
    return {
      ok: false,
      message:
        "The To date is before the From date. Pick a To date on or after From.",
    };
  }
  return { ok: true, range };
}
