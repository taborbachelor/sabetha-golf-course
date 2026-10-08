"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/codes";
import { TIERS_TAG } from "@/lib/memberships/public-tiers";
import { tierFromForm, tierRow } from "@/lib/memberships/tiers";
import { createServerSupabase } from "@/lib/supabase/server";

export type TierSaveState = {
  ok?: boolean;
  message?: string;
  /** Changes on every successful save, so the add form can start over. */
  savedAt?: number;
};

function saved(message: string): TierSaveState {
  updateTag(TIERS_TAG);
  revalidatePath("/admin/tiers");
  return { ok: true, message, savedAt: Date.now() };
}

/** Add a membership type (no id) or update one (id), as the signed-in admin. */
export async function saveTier(
  _prev: TierSaveState,
  formData: FormData,
): Promise<TierSaveState> {
  await requireAdmin("/admin/tiers");
  const parsed = tierFromForm(formData);
  if (!parsed.success) return { message: parsed.error.issues[0].message };

  const id = formData.get("id");
  const supabase = await createServerSupabase();
  const row = tierRow(parsed.data);

  if (id === null || id === "") {
    const { error } = await supabase.from("membership_tiers").insert(row);
    if (error) return { message: "Couldn't add it. Please try again." };
    return saved(`Added ${row.name}.`);
  }

  if (!isUuid(id))
    return { message: "Something went wrong. Refresh the page." };
  const { data, error } = await supabase
    .from("membership_tiers")
    .update(row)
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) {
    return { message: "Couldn't save. Please try again." };
  }
  return saved("Saved.");
}

/** Delete a type nobody has applied for or paid dues against. */
export async function deleteTier(
  _prev: TierSaveState,
  formData: FormData,
): Promise<TierSaveState> {
  await requireAdmin("/admin/tiers");
  const id = formData.get("id");
  if (!isUuid(id))
    return { message: "Something went wrong. Refresh the page." };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("membership_tiers")
    .delete()
    .eq("id", id)
    .select("id");
  // 23503: applications or dues payments still point at it.
  if (error?.code === "23503") {
    return {
      message:
        "Applications or dues payments use this type, so it can't be deleted. Rename it instead.",
    };
  }
  if (error || data.length === 0) {
    return { message: "Couldn't delete. Please try again." };
  }
  return saved("Deleted.");
}
