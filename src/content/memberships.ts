/**
 * Membership copy, adapted from sabethagolfclub.com/memberships as of
 * 2026-10-07. The club does not publish tiers or prices, so the tiers below
 * are SAMPLE placeholders with no prices until the club provides real ones.
 */

export type SampleTier = { name: string; note: string };

export const sampleTiers: SampleTier[] = [
  { name: "Family", note: "Golf, pool and clubhouse for your household" },
  { name: "Single", note: "Golf, pool and clubhouse for one adult" },
  { name: "Under 30", note: "Special rate for members under 30" },
  {
    name: "New member",
    note: "Special rate if you haven't been a member in the last 5 years",
  },
];

export const cartShed =
  "Members can rent a Cart Shed to store their own cart at the course.";

export const howToJoin = [
  "Apply online, or send an inquiry to the Club Secretary by email or mail.",
  "Include your full name, address, phone, email, the membership type you want, and whether you'd like to rent a Cart Shed.",
  "The Secretary will review it and reply with current rates.",
];

export const duesSchedule = [
  "Annual dues statements are mailed at the end of January.",
  "Pay in full by March 1, or pay half by March 1 and half by June 1.",
  "Delinquent members will be notified and may have access restricted.",
];

export const memberPerks = [
  "Bring guests for golf, the pool or a clubhouse meal. Guests can golf without a member but must be with a member at the pool.",
  "The bar stays open to members even when the kitchen closes for an event.",
  "A monthly newsletter is emailed to members.",
  "TextCaster text alerts for course conditions, clubhouse hours and food specials.",
  "Members are encouraged to help care for the grounds; volunteers are always welcome.",
];

export const bylawsUrl = "/files/sabetha-golf-club-bylaws.pdf";

/** Labels for the dues installments, matching the schedule above. */
export const installmentLabels = {
  full: { label: "In full", due: "Due March 1" },
  first: { label: "First half", due: "Due March 1" },
  second: { label: "Second half", due: "Due June 1" },
} as const;
