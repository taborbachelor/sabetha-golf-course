import { describe, expect, it } from "vitest";
import { cartsAvailable, roundWindow } from "@/lib/carts/availability";
import { defaultSettings } from "@/content/settings";
import { timeIn, zonedTimeToUtc } from "@/lib/time";
import { payFormSchema, resolveArrival } from "./form";

const TZ = "America/Chicago";
// Wed Oct 7 2026, 2:00pm in Kansas (CDT, UTC-5).
const NOW = new Date("2026-10-07T19:00:00Z");
const opts = {
  timeZone: TZ,
  bookAheadDays: 14,
  clubhouseHours: defaultSettings.clubhouseHours,
  now: NOW,
};

describe("zonedTimeToUtc", () => {
  it("converts Kansas wall time to UTC across DST", () => {
    expect(zonedTimeToUtc("2026-10-10", "14:30", TZ).toISOString()).toBe(
      "2026-10-10T19:30:00.000Z",
    );
    expect(zonedTimeToUtc("2026-12-05", "11:00", TZ).toISOString()).toBe(
      "2026-12-05T17:00:00.000Z",
    );
    expect(timeIn(TZ, new Date("2026-10-10T19:30:00Z"))).toBe("14:30");
  });
});

describe("resolveArrival", () => {
  it("adds minutes for now / ~15 / ~30 today", () => {
    const r = resolveArrival({ playDate: "2026-10-07", arrival: "15" }, opts);
    expect(r).toEqual({
      ok: true,
      arriveAt: new Date("2026-10-07T19:15:00Z"),
      anyTime: false,
    });
  });

  it("uses the picked time for later today or another day", () => {
    const r = resolveArrival(
      { playDate: "2026-10-10", arrival: "later", arrivalTime: "09:00" },
      opts,
    );
    expect(r).toEqual({
      ok: true,
      arriveAt: new Date("2026-10-10T14:00:00Z"),
      anyTime: false,
    });
  });

  it("rejects past dates, past times, far-future dates and 'now' on other days", () => {
    expect(
      resolveArrival(
        { playDate: "2026-10-06", arrival: "later", arrivalTime: "09:00" },
        opts,
      ),
    ).toMatchObject({ ok: false, field: "playDate" });
    expect(
      resolveArrival(
        { playDate: "2026-10-22", arrival: "later", arrivalTime: "09:00" },
        opts,
      ),
    ).toMatchObject({ ok: false, field: "playDate" });
    expect(
      resolveArrival(
        { playDate: "2026-10-07", arrival: "later", arrivalTime: "08:00" },
        opts,
      ),
    ).toMatchObject({ ok: false, field: "arrivalTime" });
    expect(
      resolveArrival({ playDate: "2026-10-08", arrival: "now" }, opts),
    ).toMatchObject({ ok: false, field: "arrival" });
  });
});

describe("resolveArrival without a time (paying ahead, walking)", () => {
  it("files another day at clubhouse opening time as 'any time'", () => {
    // Sat Oct 10: clubhouse opens 11am (16:00Z).
    expect(
      resolveArrival({ playDate: "2026-10-10", arrival: "later" }, opts),
    ).toEqual({
      ok: true,
      arriveAt: new Date("2026-10-10T16:00:00Z"),
      anyTime: true,
    });
  });

  it("uses noon on a day the clubhouse is closed", () => {
    // Mon Oct 12: closed.
    expect(
      resolveArrival({ playDate: "2026-10-12", arrival: "later" }, opts),
    ).toEqual({
      ok: true,
      arriveAt: new Date("2026-10-12T17:00:00Z"),
      anyTime: true,
    });
  });

  it("still needs a time to hold a cart, or for 'Pick a time' today", () => {
    expect(
      resolveArrival(
        { playDate: "2026-10-10", arrival: "later", carts: 1 },
        opts,
      ),
    ).toMatchObject({ ok: false, field: "arrivalTime" });
    expect(
      resolveArrival({ playDate: "2026-10-07", arrival: "later" }, opts),
    ).toMatchObject({ ok: false, field: "arrivalTime" });
  });

  it("catches a time that has already passed today", () => {
    expect(
      resolveArrival(
        { playDate: "2026-10-07", arrival: "later", arrivalTime: "13:00" },
        opts,
      ),
    ).toMatchObject({
      ok: false,
      field: "arrivalTime",
      message: "That time has passed",
    });
  });
});

describe("resolveArrival near midnight", () => {
  // 11:45pm Wed Oct 7 in Kansas.
  const late = { ...opts, now: new Date("2026-10-08T04:45:00Z") };

  it("rejects a 'today' arrival that would land after midnight", () => {
    expect(
      resolveArrival({ playDate: "2026-10-07", arrival: "30" }, late),
    ).toMatchObject({ ok: false, field: "arrival" });
  });

  it("still allows 'now' just before midnight", () => {
    expect(
      resolveArrival({ playDate: "2026-10-07", arrival: "now" }, late),
    ).toMatchObject({ ok: true });
  });
});

describe("payFormSchema", () => {
  const valid = {
    playDate: "2026-10-07",
    holes: 18,
    players: 4,
    carts: 2,
    arrival: "now",
    name: "Pat Golfer",
    phone: "(785) 555-0100",
    email: "pat@example.com",
  };

  it("accepts a complete form", () => {
    expect(payFormSchema.safeParse(valid).success).toBe(true);
  });

  it("flags too many carts, missing time and bad contact info", () => {
    const issues = (v: object) =>
      payFormSchema
        .safeParse({ ...valid, ...v })
        .error?.issues.map((i) => i.path[0]);
    expect(issues({ carts: 3 })).toContain("carts");
    expect(issues({ arrival: "later" })).toContain("arrivalTime");
    expect(issues({ phone: "555" })).toContain("phone");
    expect(issues({ email: "nope" })).toContain("email");
    expect(issues({ holes: 10 })).toContain("holes");
  });

  it("makes email optional, stored as an empty string", () => {
    for (const email of ["", "   "]) {
      const r = payFormSchema.safeParse({ ...valid, email });
      expect(r.success).toBe(true);
      expect(r.data?.email).toBe("");
    }
    expect(
      payFormSchema.safeParse({ ...valid, email: " pat@example.com " }).data
        ?.email,
    ).toBe("pat@example.com");
  });

  it("only requires a later time when holding a cart", () => {
    const later = { ...valid, playDate: "2026-10-10", arrival: "later" };
    expect(payFormSchema.safeParse({ ...later, carts: 0 }).success).toBe(true);
    expect(
      payFormSchema
        .safeParse({ ...later, carts: 1 })
        .error?.issues.map((i) => i.path[0]),
    ).toEqual(["arrivalTime"]);
  });
});

describe("cartsAvailable", () => {
  const at = (h: number) => new Date(Date.UTC(2026, 9, 10, h));
  const window = roundWindow(at(14), 240); // 2pm–6pm UTC

  it("subtracts carts held during the window only", () => {
    const held = [
      { start: at(12), end: at(15) }, // overlaps
      { start: at(17), end: at(19) }, // overlaps
      { start: at(8), end: at(12) }, // before
      { start: at(18), end: at(20) }, // starts exactly at window end: no overlap
    ];
    expect(cartsAvailable(8, held, window)).toBe(6);
  });

  it("never goes below zero", () => {
    expect(
      cartsAvailable(
        1,
        [
          { start: at(14), end: at(15) },
          { start: at(14), end: at(16) },
        ],
        window,
      ),
    ).toBe(0);
  });
});
