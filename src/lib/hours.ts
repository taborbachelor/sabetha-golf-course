import type { Settings } from "@/content/settings";

type HoursSettings = Pick<Settings, "timeZone" | "clubhouseHours">;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Weekday (0 = Sunday) and minutes since midnight at `date` in `timeZone`. */
export function clubClock(
  date: Date,
  timeZone: string,
): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    day: WEEKDAYS.indexOf(get("weekday")),
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** True when the clubhouse is open at `date`. Open time inclusive, close exclusive. */
export function isOpenNow(settings: HoursSettings, date: Date): boolean {
  const { day, minutes } = clubClock(date, settings.timeZone);
  const hours = settings.clubhouseHours[day];
  if (!hours) return false;
  return minutes >= toMinutes(hours.open) && minutes < toMinutes(hours.close);
}

const FULL_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * When the clubhouse next opens after `date`, in words: "today at 4:30pm",
 * "tomorrow at 11am", "Wednesday at 4:30pm". Null if it's open right now or
 * has no hours at all.
 */
export function nextOpening(
  settings: HoursSettings,
  date: Date,
): string | null {
  const next = nextOpeningSlot(settings, date);
  if (!next) return null;
  const { ahead, weekday, open } = next;
  const when =
    ahead === 0
      ? "today"
      : ahead === 1
        ? "tomorrow"
        : ahead === 7
          ? `next ${FULL_WEEKDAYS[weekday]}`
          : FULL_WEEKDAYS[weekday];
  return `${when} at ${formatTime(open)}`;
}

/**
 * The next time the clubhouse opens after `date`: how many days ahead (0 =
 * later today, 7 = same weekday next week), which weekday, and the "HH:MM"
 * opening time. Null if it's open right now or has no hours at all. Shared
 * by nextOpening() and clubhouseStatus() so they always agree.
 */
export function nextOpeningSlot(
  settings: HoursSettings,
  date: Date,
): { ahead: number; weekday: number; open: string } | null {
  const { day, minutes } = clubClock(date, settings.timeZone);
  for (let ahead = 0; ahead <= 7; ahead++) {
    const weekday = (day + ahead) % 7;
    const hours = settings.clubhouseHours[weekday];
    if (!hours) continue;
    if (ahead === 0) {
      if (minutes >= toMinutes(hours.open) && minutes < toMinutes(hours.close))
        return null; // Open now.
      if (minutes >= toMinutes(hours.open)) continue; // Already closed today.
    }
    return { ahead, weekday, open: hours.open };
  }
  return null;
}

/** "16:30" -> "4:30pm", "11:00" -> "11am". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0
    ? `${hour12}${suffix}`
    : `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
}

export type HoursRow = { days: string; hours: string };

/**
 * Week schedule for display, Monday first, with consecutive days that share
 * the same hours merged: [{ days: "Mon–Tue", hours: "Closed" }, ...].
 */
export function weeklyHours(
  clubhouseHours: Settings["clubhouseHours"],
): HoursRow[] {
  const mondayFirst = [1, 2, 3, 4, 5, 6, 0];
  const label = (day: number) => {
    const h = clubhouseHours[day];
    return h ? `${formatTime(h.open)}–${formatTime(h.close)}` : "Closed";
  };

  const rows: { first: number; last: number; hours: string }[] = [];
  for (const day of mondayFirst) {
    const hours = label(day);
    const prev = rows.at(-1);
    if (prev && prev.hours === hours) prev.last = day;
    else rows.push({ first: day, last: day, hours });
  }

  return rows.map(({ first, last, hours }) => ({
    days:
      first === last ? WEEKDAYS[first] : `${WEEKDAYS[first]}–${WEEKDAYS[last]}`,
    hours,
  }));
}

export type ClubhouseStatus = { open: boolean; text: string };

/**
 * Short open/closed line for the header badge, at `date` in the club's time
 * zone: "Open until 8pm", or when it next opens, in nextOpening()'s terms but
 * short: "Opens 4:30pm" (today), "Opens tomorrow 11am", "Opens Wed 4:30pm".
 * "Closed" only if no day of the week has hours.
 */
export function clubhouseStatus(
  settings: HoursSettings,
  date: Date,
): ClubhouseStatus {
  const { day } = clubClock(date, settings.timeZone);
  if (isOpenNow(settings, date)) {
    const close = settings.clubhouseHours[day]!.close;
    return { open: true, text: `Open until ${formatTime(close)}` };
  }
  const next = nextOpeningSlot(settings, date);
  if (!next) return { open: false, text: "Closed" };
  const when =
    next.ahead === 0
      ? ""
      : next.ahead === 1
        ? "tomorrow "
        : `${WEEKDAYS[next.weekday]} `;
  return { open: false, text: `Opens ${when}${formatTime(next.open)}` };
}
