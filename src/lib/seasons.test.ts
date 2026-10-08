import { describe, expect, it } from "vitest";
import {
  laborDay,
  longDate,
  memorialDay,
  poolOpeningDay,
  poolSeason,
  seasonComplete,
} from "./seasons";

describe("holidays", () => {
  it("finds Memorial Day (last Monday in May)", () => {
    expect(memorialDay(2026)).toBe("2026-05-25");
    expect(memorialDay(2027)).toBe("2027-05-31");
    expect(memorialDay(2028)).toBe("2028-05-29");
  });

  it("finds Labor Day (first Monday in September)", () => {
    expect(laborDay(2026)).toBe("2026-09-07");
    expect(laborDay(2027)).toBe("2027-09-06");
    expect(laborDay(2025)).toBe("2025-09-01");
  });

  it("opens the pool the Saturday of Memorial Day weekend", () => {
    expect(poolOpeningDay(2026)).toBe("2026-05-23");
    expect(poolOpeningDay(2027)).toBe("2027-05-29");
  });
});

describe("poolSeason", () => {
  it("is in season from opening Saturday through Labor Day", () => {
    expect(poolSeason("2026-05-23")).toEqual({
      inSeason: true,
      closes: "2026-09-07",
    });
    expect(poolSeason("2026-07-04").inSeason).toBe(true);
    expect(poolSeason("2026-09-07").inSeason).toBe(true);
  });

  it("before opening, points at this year's opening day", () => {
    expect(poolSeason("2026-05-22")).toEqual({
      inSeason: false,
      opens: "2026-05-23",
    });
  });

  it("after Labor Day, points at next year's opening day", () => {
    expect(poolSeason("2026-09-08")).toEqual({
      inSeason: false,
      opens: "2027-05-29",
    });
    expect(poolSeason("2026-10-08")).toEqual({
      inSeason: false,
      opens: "2027-05-29",
    });
  });
});

describe("seasonComplete", () => {
  const events = [{ lastDay: "2026-05-16" }, { lastDay: "2026-09-19" }];

  it("is false while an event is still to come or happening today", () => {
    expect(seasonComplete(events, "2026-09-18")).toBe(false);
    expect(seasonComplete(events, "2026-09-19")).toBe(false);
  });

  it("is true the day after the last event", () => {
    expect(seasonComplete(events, "2026-09-20")).toBe(true);
  });

  it("is false with no events", () => {
    expect(seasonComplete([], "2026-09-20")).toBe(false);
  });
});

describe("longDate", () => {
  it("formats a calendar date", () => {
    expect(longDate("2027-05-29")).toBe("Saturday, May 29, 2027");
  });
});
