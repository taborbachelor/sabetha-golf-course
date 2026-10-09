/**
 * Placeholder club settings, copied from the current site (sabethagolfclub.com)
 * as of 2026-10-07. SAMPLE DATA: confirm with the club before go-live.
 * These are the defaults: prices, hours and booking limits edited in /admin
 * are stored in the `settings` table and override them (src/lib/settings).
 * Read via getSettings() from "@/lib/settings"; never hardcode prices or
 * hours elsewhere.
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
    streetAddress: string;
    postalCode: string;
    mailingAddress: string;
    email: string;
    phone: string;
    facebookUrl: string;
    textCasterUrl: string;
    giftCardUrl: string;
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
  /** How long a reserved cart is held, for online cart inventory. SAMPLE. */
  roundMinutes: Record<Holes, number>;
  /** How far ahead golfers can pay online. */
  bookAheadDays: number;
  pool: {
    /** Daily swim fee for a non-member guest (with a member). */
    guestFee: number;
    gatesUnlock: string; // "HH:MM"
  };
  clubhouseRental: {
    cleanupDeposit: number;
    /** Returned if the renter does the cleanup themselves. */
    selfCleanRefund: number;
    outsideCateringFee: number;
  };
  kitchenStatus: "open" | "drinks_only" | "closed";
  /**
   * Typical Order to the Course delivery time, in minutes ("10–20 min").
   * SAMPLE until the club confirms it. Edited in /admin/settings.
   */
  deliveryMinutes: DeliveryMinutes;
};

export type DeliveryMinutes = { min: number; max: number };

export const defaultSettings: Settings = {
  isSample: true,
  club: {
    name: "Sabetha Golf Club",
    city: "Sabetha",
    state: "KS",
    locationNote: "About 1 mile north of Sabetha, Kansas",
    streetAddress: "2551 X Road",
    postalCode: "66534",
    mailingAddress: "P.O. Box 27, Sabetha, KS 66534",
    email: "sabethacountryclub@gmail.com",
    phone: "785-284-2023",
    facebookUrl: "https://www.facebook.com/sabethagolfclub",
    textCasterUrl: "https://my.textcaster.com/asa/2973",
    giftCardUrl: "https://squareup.com/gift/NB66KA3K0Y6YT/order",
  },
  course: {
    holes: 9,
    yards: 5990,
    tees: ["White", "Blue"],
    built: 1923,
    established: 1923, // logo and printed menu; "Est. 1925" on the old site is an open club question
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
  roundMinutes: { 9: 120, 18: 240 },
  bookAheadDays: 14,
  pool: { guestFee: 4, gatesUnlock: "09:00" },
  clubhouseRental: {
    cleanupDeposit: 100,
    selfCleanRefund: 50,
    outsideCateringFee: 100,
  },
  kitchenStatus: "open",
  deliveryMinutes: { min: 10, max: 20 },
};
