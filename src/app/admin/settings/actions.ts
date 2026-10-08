"use server";

import { updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { KITCHEN_STATUSES, kitchenLabels } from "@/lib/orders/kitchen";
import type { KitchenStatus } from "@/lib/orders/order";
import { SETTINGS_TAG, getSettings } from "@/lib/settings";
import { PRICES_HOURS_KEYS } from "@/lib/settings/editable";
import { deliveryFromForm, settingsFromForm } from "@/lib/settings/form";
import { createServerSupabase } from "@/lib/supabase/server";

export type SaveState = {
  ok?: boolean;
  /** Settings key the error belongs to, e.g. "green_fees". */
  key?: string;
  /** Input to focus, e.g. "cart_rental.18". */
  field?: string;
  message?: string;
  /** Green fees or cart prices changed: the printed hole #1 sign is out of date. */
  signsStale?: boolean;
};

/** Save prices, hours and booking limits; the public site updates at once. */
export async function saveSettings(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  await requireAdmin("/admin/settings");

  const result = settingsFromForm(formData);
  if (!result.ok) {
    return { key: result.key, field: result.field, message: result.message };
  }

  const before = await getSettings();
  const pricesChanged =
    JSON.stringify([before.greenFees, before.cartRental]) !==
    JSON.stringify([result.values.green_fees, result.values.cart_rental]);

  // As the signed-in admin, so the "admin write settings" policy applies.
  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("settings")
    .upsert(
      PRICES_HOURS_KEYS.map((key) => ({
        key,
        value: result.values[key],
        updated_at: now,
      })),
    )
    .select("key");
  if (error || data.length !== PRICES_HOURS_KEYS.length) {
    return { message: "Couldn't save. Please try again." };
  }

  updateTag(SETTINGS_TAG);
  return {
    ok: true,
    message: "Saved. The website now shows these.",
    signsStale: pricesChanged,
  };
}

export type OrderingState = {
  ok?: boolean;
  /** Input to focus, e.g. "delivery_minutes.max". */
  field?: string;
  message?: string;
};

/** How Order to the Course starts each day, and its typical delivery time. */
export async function saveOrdering(
  _prev: OrderingState,
  formData: FormData,
): Promise<OrderingState> {
  await requireAdmin("/admin/settings");
  const status = formData.get("kitchenDefault");
  if (!KITCHEN_STATUSES.includes(status as KitchenStatus)) {
    return { message: "Pick how ordering starts each day." };
  }
  const delivery = deliveryFromForm(formData);
  if (!delivery.ok) return { field: delivery.field, message: delivery.message };

  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("settings")
    .upsert([
      { key: "kitchen_default", value: status, updated_at: now },
      { key: "delivery_minutes", value: delivery.value, updated_at: now },
    ])
    .select("key");
  if (error || data.length !== 2) {
    return { message: "Couldn't save. Please try again." };
  }
  updateTag(SETTINGS_TAG);
  return {
    ok: true,
    message: `Saved. Ordering starts each day as ${kitchenLabels[status as KitchenStatus]}; typical delivery ${delivery.value.min}–${delivery.value.max} minutes.`,
  };
}
