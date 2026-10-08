import type { Holes, Settings } from "@/content/settings";
import { dayOfWeek } from "@/lib/dates";

export const MAX_PLAYERS = 8;

export type RoundRequest = {
  /** Calendar date "YYYY-MM-DD" in the club's time zone. */
  playDate: string;
  holes: Holes;
  players: number;
  carts: number;
};

export type RoundQuote = {
  weekend: boolean;
  greenFeeEachCents: number;
  greenFeesCents: number;
  cartFeeEachCents: number;
  cartFeesCents: number;
  totalCents: number;
};

/** Max carts a party can reserve: one per two players, rounded up. */
export function maxCartsFor(players: number): number {
  return Math.ceil(players / 2);
}

/** The Carts hint on Pay to Play, e.g. "$15 each" for 9 holes. Whole dollars drop the cents. */
export function cartPriceHint(
  cartRental: Settings["cartRental"],
  holes: Holes,
): string {
  const dollars = cartRental[holes];
  const price = Number.isInteger(dollars)
    ? `$${dollars}`
    : `$${dollars.toFixed(2)}`;
  return `${price} each`;
}

/**
 * Price for a round. Always computed on the server from settings; the
 * browser never sends an amount. Throws on invalid input.
 */
export function quoteRound(
  req: RoundRequest,
  settings: Pick<Settings, "greenFees" | "cartRental">,
): RoundQuote {
  if (req.holes !== 9 && req.holes !== 18)
    throw new Error("holes must be 9 or 18");
  if (
    !Number.isInteger(req.players) ||
    req.players < 1 ||
    req.players > MAX_PLAYERS
  ) {
    throw new Error(`players must be 1–${MAX_PLAYERS}`);
  }
  if (
    !Number.isInteger(req.carts) ||
    req.carts < 0 ||
    req.carts > maxCartsFor(req.players)
  ) {
    throw new Error("too many carts for the party size");
  }

  const day = dayOfWeek(req.playDate);
  const weekend = day === 0 || day === 6;
  const greenFeeEachCents =
    settings.greenFees[weekend ? "weekend" : "weekday"][req.holes] * 100;
  const cartFeeEachCents = settings.cartRental[req.holes] * 100;
  const greenFeesCents = greenFeeEachCents * req.players;
  const cartFeesCents = cartFeeEachCents * req.carts;

  return {
    weekend,
    greenFeeEachCents,
    greenFeesCents,
    cartFeeEachCents,
    cartFeesCents,
    totalCents: greenFeesCents + cartFeesCents,
  };
}
