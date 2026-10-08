"use server";

import { getSettings } from "@/content/settings";
import { roundWindow } from "@/lib/carts/availability";
import { availableCartCount } from "@/lib/carts/queries";
import { resolveArrival, type PayForm } from "@/lib/rounds/form";

export type CartCheck =
  { ok: true; available: number } | { ok: false; message: string };

/** How many carts are free for the party's date, arrival and round length. */
export async function checkCarts(
  input: Pick<PayForm, "playDate" | "arrival" | "arrivalTime" | "holes">,
): Promise<CartCheck> {
  const settings = getSettings();
  if (input.holes !== 9 && input.holes !== 18) {
    return { ok: false, message: "Pick 9 or 18 holes" };
  }

  const arrival = resolveArrival(input, {
    timeZone: settings.timeZone,
    bookAheadDays: settings.bookAheadDays,
  });
  if (!arrival.ok) return { ok: false, message: arrival.message };

  try {
    const available = await availableCartCount(
      roundWindow(arrival.arriveAt, settings.roundMinutes[input.holes]),
      settings.roundMinutes,
    );
    return { ok: true, available };
  } catch {
    return { ok: false, message: "Couldn't check carts right now" };
  }
}
