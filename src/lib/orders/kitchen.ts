import { todayIn } from "@/lib/dates";
import type { KitchenStatus } from "./order";

export const KITCHEN_STATUSES = ["open", "drinks_only", "closed"] as const;

export const kitchenLabels: Record<KitchenStatus, string> = {
  open: "Kitchen open",
  drinks_only: "Drinks only",
  closed: "Ordering closed",
};

export function asKitchenStatus(
  value: unknown,
  fallback: KitchenStatus = "closed",
): KitchenStatus {
  return KITCHEN_STATUSES.includes(value as KitchenStatus)
    ? (value as KitchenStatus)
    : fallback;
}

/**
 * The kitchen status in effect right now. Staff flip it during the day; the
 * next day (club time) it goes back to the admin's default, so nobody has
 * to remember to reopen ordering after a "Drinks only" evening.
 */
export function effectiveKitchen(opts: {
  status: unknown;
  /** When staff last set it (settings.updated_at). */
  setAt: string | null | undefined;
  defaultStatus: unknown;
  timeZone: string;
  now?: Date;
}): KitchenStatus {
  const fallback = asKitchenStatus(opts.defaultStatus, "open");
  if (!opts.setAt) return fallback;
  const setAt = new Date(opts.setAt);
  if (Number.isNaN(setAt.getTime())) return fallback;
  const now = opts.now ?? new Date();
  return todayIn(opts.timeZone, setAt) === todayIn(opts.timeZone, now)
    ? asKitchenStatus(opts.status)
    : fallback;
}
