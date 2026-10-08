"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { SETTINGS_TAG } from "@/lib/settings";
import { EDITABLE_KEYS } from "@/lib/settings/editable";
import { settingsFromForm } from "@/lib/settings/form";
import { createServerSupabase } from "@/lib/supabase/server";

export type SaveState = {
  ok?: boolean;
  /** Settings key the error belongs to, e.g. "green_fees". */
  key?: string;
  message?: string;
};

/** Save prices, hours and booking limits; the public site updates at once. */
export async function saveSettings(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  await requireAdmin("/admin/settings");

  const result = settingsFromForm(formData);
  if (!result.ok) return { key: result.key, message: result.message };

  // As the signed-in admin, so the "admin write settings" policy applies.
  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("settings")
    .upsert(
      EDITABLE_KEYS.map((key) => ({
        key,
        value: result.values[key],
        updated_at: now,
      })),
    )
    .select("key");
  if (error || data.length !== EDITABLE_KEYS.length) {
    return { message: "Couldn't save. Please try again." };
  }

  updateTag(SETTINGS_TAG);
  return {
    ok: true,
    message: "Saved. The website now shows these.",
  };
}
