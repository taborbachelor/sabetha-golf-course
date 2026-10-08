import { describe, expect, it } from "vitest";
import { effectiveKitchen } from "./kitchen";

const TZ = "America/Chicago";
// Thu Oct 8 2026, 7:00pm in Kansas (CDT, UTC-5).
const now = new Date("2026-10-09T00:00:00Z");

describe("effectiveKitchen", () => {
  it("uses what staff set today", () => {
    expect(
      effectiveKitchen({
        status: "drinks_only",
        setAt: "2026-10-08T15:00:00Z", // 10am Kansas, same day
        defaultStatus: "open",
        timeZone: TZ,
        now,
      }),
    ).toBe("drinks_only");
  });

  it("goes back to the default the next club day", () => {
    expect(
      effectiveKitchen({
        status: "closed",
        // 11:30pm Kansas on Oct 7, even though it's Oct 8 in UTC.
        setAt: "2026-10-08T04:30:00Z",
        defaultStatus: "drinks_only",
        timeZone: TZ,
        now,
      }),
    ).toBe("drinks_only");
  });

  it("falls back to open for a missing or bad default", () => {
    const old = "2026-10-01T15:00:00Z";
    expect(
      effectiveKitchen({
        status: "closed",
        setAt: old,
        defaultStatus: undefined,
        timeZone: TZ,
        now,
      }),
    ).toBe("open");
    expect(
      effectiveKitchen({
        status: "closed",
        setAt: null,
        defaultStatus: "nope",
        timeZone: TZ,
        now,
      }),
    ).toBe("open");
  });

  it("treats a bad stored status as closed", () => {
    expect(
      effectiveKitchen({
        status: "maybe",
        setAt: "2026-10-08T15:00:00Z",
        defaultStatus: "open",
        timeZone: TZ,
        now,
      }),
    ).toBe("closed");
  });
});
