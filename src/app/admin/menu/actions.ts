"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/codes";
import { MENU_TAG } from "@/lib/menu";
import { menuItemFromForm, menuItemRow } from "@/lib/menu/form";
import { createServerSupabase } from "@/lib/supabase/server";

export type MenuSaveState = {
  ok?: boolean;
  message?: string;
  /** Changes on every successful save, so the add form can start over. */
  savedAt?: number;
};

function saved(message: string): MenuSaveState {
  updateTag(MENU_TAG);
  revalidatePath("/admin/menu");
  return { ok: true, message, savedAt: Date.now() };
}

/** Add a menu item (no id) or update one (id). Runs as the signed-in admin. */
export async function saveMenuItem(
  _prev: MenuSaveState,
  formData: FormData,
): Promise<MenuSaveState> {
  await requireAdmin("/admin/menu");
  const parsed = menuItemFromForm(formData);
  if (!parsed.success) return { message: parsed.error.issues[0].message };

  const id = formData.get("id");
  const supabase = await createServerSupabase();
  const row = menuItemRow(parsed.data);

  if (id === null || id === "") {
    const { error } = await supabase.from("menu_items").insert(row);
    if (error) return { message: "Couldn't add the item. Please try again." };
    return saved(`Added ${row.name}.`);
  }

  if (!isUuid(id))
    return { message: "Something went wrong. Refresh the page." };
  const { data, error } = await supabase
    .from("menu_items")
    .update(row)
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) {
    return { message: "Couldn't save. Please try again." };
  }
  return saved("Saved.");
}

/** Remove an item for good. Past orders keep their own copy of names and prices. */
export async function deleteMenuItem(
  _prev: MenuSaveState,
  formData: FormData,
): Promise<MenuSaveState> {
  await requireAdmin("/admin/menu");
  const id = formData.get("id");
  if (!isUuid(id))
    return { message: "Something went wrong. Refresh the page." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("menu_items")
    .delete()
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) {
    return { message: "Couldn't delete. Please try again." };
  }
  return saved("Deleted.");
}
