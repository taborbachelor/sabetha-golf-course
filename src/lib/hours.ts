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
