import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { defaultSettings, type Settings } from "@/content/settings";
import { EDITABLE_KEYS, mergeSettings } from "./editable";
import { createAdminClient } from "@/lib/supabase/admin";

/** Cache tag for club settings. Admin saves call updateTag(SETTINGS_TAG). */
export const SETTINGS_TAG = "settings";

/**
 * Club settings: defaults from src/content/settings.ts overlaid with the
 * admin-edited rows in the `settings` table. Cached (pages stay static) and
 * refreshed the moment an admin saves.
 */
export async function getSettings(): Promise<Settings> {
  "use cache";
  cacheTag(SETTINGS_TAG);

  try {
    const { data, error } = await createAdminClient()
      .from("settings")
      .select("key, value")
      .in("key", EDITABLE_KEYS);
    if (error) throw error;
    cacheLife("max");
    return mergeSettings(defaultSettings, data);
  } catch {
    // No database (CI builds) or a blip: serve the defaults, retry soon.
    cacheLife("minutes");
    return defaultSettings;
  }
}
