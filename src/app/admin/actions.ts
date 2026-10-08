"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/codes";
import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from "@/lib/memberships/application";
import { siteUrl } from "@/lib/site";
import { createServerSupabase } from "@/lib/supabase/server";

export type ApplicationState = { ok?: boolean; message?: string };

const done: Record<ApplicationStatus, (name: string) => string> = {
  approved: (name) =>
    `Approved ${name}. Next: tell them to pay their dues at ${new URL("/memberships/dues", siteUrl()).href}`,
  rejected: (name) => `Declined ${name}. Let them know directly.`,
  submitted: (name) => `${name} is back under New.`,
};

/**
 * Club Secretary marks an application approved, declined, or back to new.
 * Always answers with a message; never throws to the error page.
 */
export async function setApplicationStatus(
  _prev: ApplicationState,
  formData: FormData,
): Promise<ApplicationState> {
  await requireAdmin();
  const id = formData.get("id");
  const status = formData.get("status") as ApplicationStatus;
  if (!isUuid(id) || !APPLICATION_STATUSES.includes(status)) {
    return { message: "Something went wrong. Reload the page and try again." };
  }

  try {
    // As the signed-in admin, so the "admin update applications" policy applies.
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("membership_applications")
      .update({ status })
      .eq("id", id)
      .select("name");
    if (error || data.length === 0) {
      return {
        message: "Couldn't update the application. Please try again.",
      };
    }
    revalidatePath("/admin");
    return { ok: true, message: done[status](data[0].name) };
  } catch {
    return {
      message: "Couldn't update the application. Please try again.",
    };
  }
}
