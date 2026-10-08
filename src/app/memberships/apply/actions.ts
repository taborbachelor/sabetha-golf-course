"use server";

import { redirect } from "next/navigation";
import {
  applicationFromForm,
  applicationSchema,
  type Application,
} from "@/lib/memberships/application";
import { createAdminClient } from "@/lib/supabase/admin";

/** Values are echoed back so the fields keep what was typed after an error. */
export type ApplyState = {
  error?: string;
  field?: keyof Application;
  values?: ReturnType<typeof applicationFromForm>;
};

/**
 * Save a membership application for the Club Secretary to review in /admin.
 * Nothing is emailed; the confirmation is the next page.
 */
export async function submitApplication(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  // Hidden from people; bots that fill every field get a quiet no-op.
  if (String(formData.get("website") ?? "") !== "") redirect("/memberships");

  const values = applicationFromForm(formData);
  const parsed = applicationSchema.safeParse(values);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: issue.message,
      field: issue.path[0] as keyof Application,
      values,
    };
  }
  const app = parsed.data;
  const db = createAdminClient();

  const tier = await db
    .from("membership_tiers")
    .select("id")
    .eq("id", app.tierId)
    .maybeSingle();
  if (tier.error) {
    return { error: "Couldn't reach the server. Please try again.", values };
  }
  if (!tier.data) {
    return { error: "Pick a membership type", field: "tierId", values };
  }

  const { data, error } = await db
    .from("membership_applications")
    .insert({
      tier_id: app.tierId,
      name: app.name,
      address: app.address,
      phone: app.phone,
      email: app.email,
      cart_shed: app.cartShed,
    })
    .select("id")
    .single();
  if (error || !data) {
    return {
      error: "Couldn't save your application. Please try again.",
      values,
    };
  }

  redirect(`/memberships/apply/received/${data.id}`);
}
