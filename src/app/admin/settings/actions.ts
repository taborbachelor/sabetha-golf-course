"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { KITCHEN_STATUSES, kitchenLabels } from "@/lib/orders/kitchen";
import type { KitchenStatus } from "@/lib/orders/order";
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

export type KitchenDefaultState = { ok?: boolean; message?: string };

/** What Order to the Course starts each day as. */
export async function saveKitchenDefault(
  _prev: KitchenDefaultState,
  formData: FormData,
): Promise<KitchenDefaultState> {
  await requireAdmin("/admin/settings");
  const status = formData.get("kitchenDefault");
  if (!KITCHEN_STATUSES.includes(status as KitchenStatus)) {
    return { message: "Pick one of the options." };
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("settings")
    .upsert({
      key: "kitchen_default",
      value: status,
      updated_at: new Date().toISOString(),
    })
    .select("key");
  if (error || data.length !== 1) {
    return { message: "Couldn't save. Please try again." };
  }
  return {
    ok: true,
    message: `Saved. Ordering starts each day as ${kitchenLabels[status as KitchenStatus]}.`,
  };
}
