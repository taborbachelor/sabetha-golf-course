import "server-only";
import { connection } from "next/server";
import { getSettings } from "@/content/settings";
import { isOpenNow } from "@/lib/hours";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderableItems, type KitchenStatus, type MenuRow } from "./order";

export type OrderingState = {
  kitchen: KitchenStatus;
  clubhouseOpen: boolean;
  ignoreHoursForDemo: boolean;
  /** True when orders are being taken right now. */
  accepting: boolean;
  /** Why not, in words a golfer understands. */
  closedReason: string | null;
  /** Everything on the menu (for pricing). */
  menu: MenuRow[];
  /** What can be ordered right now. */
  orderable: MenuRow[];
};

/** Kitchen status, hours and menu, read fresh for every request. */
export async function getOrderingState(): Promise<OrderingState> {
  await connection();
  const db = createAdminClient();
  const [settingsRows, menuRows] = await Promise.all([
    db
      .from("settings")
      .select("key, value")
      .in("key", ["kitchen_status", "ignore_hours_for_demo"]),
    db
      .from("menu_items")
      .select(
        "id, name, category, price_cents, is_food, is_alcohol, available, is_sample, sort_order",
      ),
  ]);
  if (settingsRows.error) throw settingsRows.error;
  if (menuRows.error) throw menuRows.error;

  const value = (key: string) =>
    settingsRows.data.find((r) => r.key === key)?.value as unknown;
  const kitchenValue = value("kitchen_status");
  const kitchen: KitchenStatus =
    kitchenValue === "open" || kitchenValue === "drinks_only"
      ? kitchenValue
      : "closed";
  const ignoreHoursForDemo = value("ignore_hours_for_demo") === true;
  const clubhouseOpen = isOpenNow(getSettings(), new Date());
  const menu = menuRows.data as MenuRow[];

  const closedReason =
    !clubhouseOpen && !ignoreHoursForDemo
      ? "The clubhouse is closed right now, so we can't take orders. Check the hours below."
      : kitchen === "closed"
        ? "Ordering to the course is closed right now. Stop by the clubhouse."
        : null;

  return {
    kitchen,
    clubhouseOpen,
    ignoreHoursForDemo,
    accepting: closedReason === null,
    closedReason,
    menu,
    orderable: closedReason ? [] : orderableItems(menu, kitchen),
  };
}
