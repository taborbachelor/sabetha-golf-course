/**
 * Date-aware season copy for the Pool and Events pages. Dates are calendar
 * dates "YYYY-MM-DD" in the club's time zone (see todayIn in ./dates).
 */

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Memorial Day: the last Monday in May. */
export function memorialDay(year: number): string {
  const may31 = new Date(Date.UTC(year, 4, 31)).getUTCDay();
  return iso(year, 5, 31 - ((may31 + 6) % 7));
}

/** Labor Day: the first Monday in September. */
export function laborDay(year: number): string {
  const sep1 = new Date(Date.UTC(year, 8, 1)).getUTCDay();
  return iso(year, 9, 1 + ((8 - sep1) % 7));
}

/** The Saturday of Memorial Day weekend, when the pool opens. */
export function poolOpeningDay(year: number): string {
  const [, , d] = memorialDay(year).split("-").map(Number);
  return iso(year, 5, d - 2);
}

export type PoolSeason =
  { inSeason: true; closes: string } | { inSeason: false; opens: string };

/**
 * Whether the pool is in season on `today`: from the Saturday of Memorial Day
 * weekend through Labor Day. Out of season, `opens` is the next opening day.
 * (The club may add a few days after Labor Day if the weather holds; that's
 * announced on Facebook, not predicted here.)
 */
export function poolSeason(today: string): PoolSeason {
  const year = Number(today.slice(0, 4));
  const opens = poolOpeningDay(year);
  const closes = laborDay(year);
  if (today < opens) return { inSeason: false, opens };
  if (today <= closes) return { inSeason: true, closes };
  return { inSeason: false, opens: poolOpeningDay(year + 1) };
}

/** True once every event's last day is before `today`. */
export function seasonComplete(
  events: { lastDay: string }[],
  today: string,
): boolean {
  return events.length > 0 && events.every((e) => e.lastDay < today);
}

/** "2027-05-29" -> "Saturday, May 29, 2027". */
export function longDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
