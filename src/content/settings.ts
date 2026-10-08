/**
 * Placeholder club settings, copied from the current site (sabethagolfclub.com)
 * as of 2026-10-07. SAMPLE DATA: confirm with the club before go-live.
 * These are the seed/fallback values; the `settings` table will replace them.
 * Read via getSettings(); never hardcode prices or hours elsewhere.
 */

export type Holes = 9 | 18;

export type DayHours = { open: string; close: string } | null; // "HH:MM" 24h, null = closed

export type Settings = {
  isSample: boolean;
  club: {
    name: string;
    city: string;
    state: string;
    locationNote: string;
    email: string;
    phone: string;
  };
  course: {
    holes: 9;
    yards: number;
    tees: string[];
    built: number;
    established: number;
  };
  /** IANA time zone the hours below are written in. */
  timeZone: string;
  /** Index 0 = Sunday ... 6 = Saturday, in the club's time zone. */
  clubhouseHours: DayHours[];
  greenFees: {
    weekday: Record<Holes, number>;
    weekend: Record<Holes, number>;
  };
  cartRental: Record<Holes, number>;
  kitchenStatus: "open" | "drinks_only" | "closed";
};

const settings: Settings = {
  isSample: true,
  club: {
    name: "Sabetha Golf Club",
    city: "Sabetha",
    state: "KS",
    locationNote: "About 1 mile north of Sabetha, Kansas",
    email: "TODO: confirm",
    phone: "TODO: confirm",
  },
  course: {
    holes: 9,
    yards: 5990,
    tees: ["White", "Blue"],
    built: 1923,
    established: 1925,
  },
  timeZone: "America/Chicago",
  clubhouseHours: [
    { open: "11:00", close: "19:00" }, // Sun
    null, // Mon
    null, // Tue
    { open: "16:30", close: "20:00" }, // Wed
    { open: "16:30", close: "20:00" }, // Thu
    { open: "16:30", close: "20:00" }, // Fri
    { open: "11:00", close: "20:00" }, // Sat
  ],
  greenFees: {
    weekday: { 9: 20, 18: 30 },
    weekend: { 9: 25, 18: 35 },
  },
  cartRental: { 9: 15, 18: 20 },
  kitchenStatus: "open",
};

export function getSettings(): Settings {
  return settings;
}
