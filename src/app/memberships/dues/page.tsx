import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { duesSchedule } from "@/content/memberships";
import { createAdminClient } from "@/lib/supabase/admin";
import { DuesForm, type DuesTier } from "./DuesForm";

export const metadata: Metadata = {
  title: "Pay Membership Dues",
  description:
    "Pay Sabetha Golf Club membership dues online, in full or in two halves.",
};

export default function DuesPage() {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="text-3xl font-bold">Pay Membership Dues</h1>
      <p className="mt-2 text-stone-600">
        Pay in full by March 1, or half by March 1 and half by June 1.
      </p>
      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Demo: payments run in test mode and the dues shown are samples until the
        club confirms its real rates.
      </p>
      <div className="mt-6">
        <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
          <DuesLoader />
        </Suspense>
      </div>
      <ul className="mt-8 list-disc space-y-1 pl-5 text-sm text-stone-600">
        {duesSchedule.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-4 text-sm">
        Not a member yet?{" "}
        <Link href="/memberships/apply" className="text-green-800 underline">
          Apply online
        </Link>
      </p>
    </div>
  );
}

async function DuesLoader() {
  await connection();
  const { data, error } = await createAdminClient()
    .from("membership_tiers")
    .select("id, name, price_cents, is_sample")
    .order("sort_order");
  if (error) throw error;

  const tiers: DuesTier[] = data.map((t) => ({
    id: t.id,
    name: t.name,
    priceCents: t.price_cents,
    isSample: t.is_sample,
  }));
  return <DuesForm tiers={tiers} />;
}
