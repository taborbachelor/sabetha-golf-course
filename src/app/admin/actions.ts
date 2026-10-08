"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/codes";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from "@/lib/memberships/application";
import { createServerSupabase } from "@/lib/supabase/server";

/** Club Secretary marks an application approved, declined, or back to new. */
export async function setApplicationStatus(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id");
  const status = formData.get("status") as ApplicationStatus;
  if (!isUuid(id) || !APPLICATION_STATUSES.includes(status)) return;

  // As the signed-in admin, so the "admin update applications" policy applies.
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("membership_applications")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error || data.length === 0) {
    throw new Error("Couldn't update the application. Please try again.");
  }
  revalidatePath("/admin");
}
