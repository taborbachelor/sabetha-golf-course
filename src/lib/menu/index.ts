import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { MenuRow } from "@/lib/orders/order";
import { createAdminClient } from "@/lib/supabase/admin";

/** Cache tag for the public menu. Admin saves call updateTag(MENU_TAG). */
export const MENU_TAG = "menu";

export const MENU_COLUMNS =
  "id, name, category, price_cents, is_food, is_alcohol, available, is_sample, sort_order";

/**
 * Items shown on the public /menu page (available only). Cached so the page
 * stays static; refreshed the moment an admin saves. Order to the Course
 * reads the menu fresh instead (src/lib/orders/state.ts).
 */
export async function getPublicMenu(): Promise<MenuRow[] | null> {
  "use cache";
  cacheTag(MENU_TAG);

  try {
    const { data, error } = await createAdminClient()
      .from("menu_items")
      .select(MENU_COLUMNS)
      .eq("available", true);
    if (error) throw error;
    cacheLife("max");
    return data as MenuRow[];
  } catch {
    // No database (CI builds) or a blip: the page shows the printed menu.
    cacheLife("minutes");
    return null;
  }
}
