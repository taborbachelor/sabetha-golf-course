import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getSettings } from "@/lib/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApplyForm, type TierOption } from "./ApplyForm";

export const metadata: Metadata = {
  title: "Apply for Membership",
  description:
    "Apply online to join Sabetha Golf Club. The Club Secretary reviews every application and follows up with current rates.",
};

export default async function ApplyPage() {
  const { club } = await getSettings();

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="text-3xl font-bold">Apply for Membership</h1>
      <p className="mt-2 text-stone-600">
        Send your application to the Club Secretary. They&apos;ll review it and
        contact you about next steps and how to pay dues.
      </p>
      <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
        Demo: membership types are samples until the club confirms its real
        tiers.
      </p>
      <div className="mt-6">
        <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
          <ApplyLoader />
        </Suspense>
      </div>
      <p className="mt-6 text-sm text-stone-600">
        Prefer email? Write to{" "}
        <a
          href={`mailto:${club.email}`}
          className="break-all text-green-800 underline"
        >
          {club.email}
        </a>
        .{" "}
        <Link href="/memberships" className="text-green-800 underline">
          About memberships
        </Link>
      </p>
    </div>
  );
}

async function ApplyLoader() {
  await connection();
  const { data, error } = await createAdminClient()
    .from("membership_tiers")
    .select("id, name, notes, is_sample")
    .order("sort_order");
  if (error) throw error;

  const tiers: TierOption[] = data.map((t) => ({
    id: t.id,
    name: t.name,
    notes: t.notes,
    isSample: t.is_sample,
  }));
  return <ApplyForm tiers={tiers} />;
}
