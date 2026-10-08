import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { TIER_COLUMNS, type TierRow } from "./tiers";

/** Cache tag for membership types. Admin saves call updateTag(TIERS_TAG). */
export const TIERS_TAG = "tiers";

/**
 * Membership types for the public Memberships page, cached so the page
 * stays static and refreshed the moment an admin saves. The apply and dues
 * forms read the table fresh instead. Null when the database can't be
 * reached (CI builds); the page then shows the sample list from content.
 */
export async function getPublicTiers(): Promise<TierRow[] | null> {
  "use cache";
  cacheTag(TIERS_TAG);

  try {
    const { data, error } = await createAdminClient()
      .from("membership_tiers")
      .select(TIER_COLUMNS)
      .order("sort_order");
    if (error) throw error;
    cacheLife("max");
    return data as TierRow[];
  } catch {
    cacheLife("minutes");
    return null;
  }
}
