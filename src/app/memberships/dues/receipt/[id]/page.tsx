import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { installmentLabels } from "@/content/memberships";
import { getSettings } from "@/lib/settings";
import { isUuid } from "@/lib/codes";
import {
  duesReceiptCode,
  duesSeason,
  type Installment,
} from "@/lib/memberships/dues";
import { formatDollars } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: "Dues receipt",
  robots: { index: false, follow: false },
};

type DuesPayment = {
  member_name: string;
  email: string;
  installment: Installment;
  amount_cents: number;
  created_at: string;
  membership_tiers: { name: string } | null;
};

export default function DuesReceiptPage({
  params,
}: PageProps<"/memberships/dues/receipt/[id]">) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
        <Receipt params={params} />
      </Suspense>
    </div>
  );
}

async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const { data } = await createAdminClient()
    .from("dues_payments")
    .select(
      "member_name, email, installment, amount_cents, created_at, membership_tiers(name)",
    )
    .eq("id", id)
    .maybeSingle<DuesPayment>();
  if (!data) notFound();

  const { timeZone } = await getSettings();
  const paidAt = new Date(data.created_at);
  const season = duesSeason(paidAt, timeZone);
  const paidOn = paidAt.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  const rows = [
    ["Receipt", duesReceiptCode(id)],
    ["Member", data.member_name],
    ["Email", data.email],
    ["Membership", data.membership_tiers?.name ?? "—"],
    ["Season", `${season} season`],
    ["Payment", installmentLabels[data.installment].label],
    ["Date", paidOn],
    ["Paid", formatDollars(data.amount_cents)],
  ];

  return (
    <div>
      <p className="flex items-center gap-2 font-semibold text-green-800">
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-full bg-green-800 text-sm text-white"
        >
          ✓
        </span>
        Dues paid. Thank you!
      </p>
      <h1 className="mt-3 text-3xl font-bold">Dues receipt</h1>
      <p className="mt-2">
        Nothing is emailed. Keep this page or take a screenshot for your
        records.
      </p>
      <dl className="mt-6 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-4 py-2.5">
            <dt className="text-stone-600">{label}</dt>
            <dd className="text-right font-medium break-all">{value}</dd>
          </div>
        ))}
      </dl>
      {data.installment === "first" && (
        <p className="mt-4 rounded-lg bg-stone-100 px-4 py-3">
          The second half is due by June 1, {season}.
        </p>
      )}
      <Link
        href="/memberships"
        className="mt-6 inline-block font-medium text-green-800 underline"
      >
        Back to Memberships
      </Link>
    </div>
  );
}
