import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { asKitchenStatus } from "@/lib/orders/kitchen";
import { getSettings } from "@/lib/settings";
import { editableFrom } from "@/lib/settings/editable";
import { createServerSupabase } from "@/lib/supabase/server";
import { KitchenDefaultForm } from "./KitchenDefaultForm";
import { SettingsForm } from "./SettingsForm";

export const metadata: Metadata = {
  title: "Admin: Prices & hours",
  robots: { index: false, follow: false },
};

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <SettingsLoader />
    </Suspense>
  );
}

async function SettingsLoader() {
  await requireAdmin("/admin/settings");
  const settings = await getSettings();
  const values = editableFrom(settings);
  const { data: kitchenRow } = await (
    await createServerSupabase()
  )
    .from("settings")
    .select("value")
    .eq("key", "kitchen_default")
    .maybeSingle();

  return (
    <div>
      <p className="mb-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Sample values copied from the current website. Saving updates Pay to
        Play, the rates on every page and the clubhouse hours right away.
      </p>
      <SettingsForm values={values} />
      <div className="mt-10 border-t border-stone-200 pt-8">
        <KitchenDefaultForm
          value={asKitchenStatus(kitchenRow?.value, "open")}
        />
      </div>
    </div>
  );
}
