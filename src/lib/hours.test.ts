import { describe, expect, it } from "vitest";
import { getSettings } from "@/content/settings";
import { clubClock, formatTime, isOpenNow, weeklyHours } from "./hours";

// Sample hours: Mon-Tue closed; Wed-Fri 16:30-20:00; Sat 11-20; Sun 11-19.
// Club time is America/Chicago: CDT (UTC-5) in October, CST (UTC-6) in December.
const settings = getSettings();
const open = (iso: string) => isOpenNow(settings, new Date(iso));

describe("isOpenNow", () => {
  it("is closed all day Monday and Tuesday", () => {
    expect(open("2026-10-05T17:00:00Z")).toBe(false); // Mon 12:00
    expect(open("2026-10-06T22:00:00Z")).toBe(false); // Tue 17:00
  });

  it("opens at the open time, not before", () => {
    expect(open("2026-10-07T21:29:00Z")).toBe(false); // Wed 16:29
    expect(open("2026-10-07T21:30:00Z")).toBe(true); // Wed 16:30
    expect(open("2026-10-10T15:59:00Z")).toBe(false); // Sat 10:59
    expect(open("2026-10-10T16:00:00Z")).toBe(true); // Sat 11:00
  });

  it("closes at the close time", () => {
    expect(open("2026-10-08T00:59:00Z")).toBe(true); // Wed 19:59
    expect(open("2026-10-08T01:00:00Z")).toBe(false); // Wed 20:00
    expect(open("2026-10-11T23:59:00Z")).toBe(true); // Sun 18:59
    expect(open("2026-10-12T00:00:00Z")).toBe(false); // Sun 19:00
  });

  it("uses the club's day, not the UTC day", () => {
    // Thursday in UTC, still Wednesday evening in Kansas.
    expect(open("2026-10-08T00:30:00Z")).toBe(true); // Wed 19:30
  });

  it("follows daylight saving time", () => {
    expect(open("2026-12-05T16:30:00Z")).toBe(false); // Sat 10:30 CST
    expect(open("2026-12-05T17:00:00Z")).toBe(true); // Sat 11:00 CST
  });
});

describe("clubClock", () => {
  it("reports midnight as minute 0", () => {
    expect(
      clubClock(new Date("2026-10-08T05:00:00Z"), "America/Chicago"),
    ).toEqual({ day: 4, minutes: 0 });
  });
});

describe("formatTime", () => {
  it("drops :00 and uses am/pm", () => {
    expect(formatTime("11:00")).toBe("11am");
    expect(formatTime("16:30")).toBe("4:30pm");
    expect(formatTime("12:00")).toBe("12pm");
    expect(formatTime("00:15")).toBe("12:15am");
  });
});

describe("weeklyHours", () => {
  it("starts Monday and merges days with the same hours", () => {
    expect(weeklyHours(settings.clubhouseHours)).toEqual([
      { days: "Mon–Tue", hours: "Closed" },
      { days: "Wed–Fri", hours: "4:30pm–8pm" },
      { days: "Sat", hours: "11am–8pm" },
      { days: "Sun", hours: "11am–7pm" },
    ]);
  });
});
