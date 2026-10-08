import { describe, expect, it } from "vitest";
import { defaultSettings } from "@/content/settings";
import { dayOfWeek, isIsoDate, todayIn } from "./dates";
import { maxCartsFor, quoteRound } from "./pricing";

// Sample rates: weekday 9=$20/18=$30, weekend 9=$25/18=$35; cart 9=$15/18=$20.
const settings = defaultSettings;
const WED = "2026-10-07";
const SAT = "2026-10-10";
const SUN = "2026-10-11";

describe("quoteRound", () => {
  it("prices weekday and weekend green fees per player", () => {
    expect(
      quoteRound({ playDate: WED, holes: 9, players: 1, carts: 0 }, settings)
        .totalCents,
    ).toBe(2000);
    expect(
      quoteRound({ playDate: WED, holes: 18, players: 1, carts: 0 }, settings)
        .totalCents,
    ).toBe(3000);
    expect(
      quoteRound({ playDate: SAT, holes: 9, players: 1, carts: 0 }, settings)
        .totalCents,
    ).toBe(2500);
    expect(
      quoteRound({ playDate: SUN, holes: 18, players: 1, carts: 0 }, settings)
        .totalCents,
    ).toBe(3500);
  });

  it("adds carts at the 9 or 18 hole cart rate", () => {
    const q = quoteRound(
      { playDate: SAT, holes: 18, players: 4, carts: 2 },
      settings,
    );
    expect(q).toEqual({
      weekend: true,
      greenFeeEachCents: 3500,
      greenFeesCents: 14000,
      cartFeeEachCents: 2000,
      cartFeesCents: 4000,
      totalCents: 18000,
    });
    expect(
      quoteRound({ playDate: WED, holes: 9, players: 2, carts: 1 }, settings)
        .totalCents,
    ).toBe(2 * 2000 + 1500);
  });

  it("rejects bad input instead of guessing", () => {
    const ok = { playDate: WED, holes: 9 as const, players: 2, carts: 1 };
    expect(() => quoteRound({ ...ok, players: 0 }, settings)).toThrow();
    expect(() => quoteRound({ ...ok, players: 9 }, settings)).toThrow();
    expect(() => quoteRound({ ...ok, players: 1.5 }, settings)).toThrow();
    expect(() => quoteRound({ ...ok, carts: 2 }, settings)).toThrow(); // 2 players -> max 1 cart
    expect(() => quoteRound({ ...ok, carts: -1 }, settings)).toThrow();
    expect(() => quoteRound({ ...ok, holes: 27 as 9 }, settings)).toThrow();
    expect(() =>
      quoteRound({ ...ok, playDate: "2026-02-30" }, settings),
    ).toThrow();
  });

  it("allows one cart per two players, rounded up", () => {
    expect([1, 2, 3, 4, 5].map(maxCartsFor)).toEqual([1, 1, 2, 2, 3]);
  });
});

describe("date helpers", () => {
  it("validates calendar dates", () => {
    expect(isIsoDate("2026-10-07")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-10-7")).toBe(false);
  });

  it("gets the weekday from the date itself, not the server zone", () => {
    expect(dayOfWeek(WED)).toBe(3);
    expect(dayOfWeek(SAT)).toBe(6);
  });

  it("gives today's date in the club's time zone", () => {
    // 03:00 UTC Oct 8 is still Oct 7 in Kansas.
    expect(todayIn("America/Chicago", new Date("2026-10-08T03:00:00Z"))).toBe(
      "2026-10-07",
    );
  });
});
