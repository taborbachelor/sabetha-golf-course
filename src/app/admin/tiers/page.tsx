import type { Metadata } from "next";
import { Suspense } from "react";
import { formatPrice } from "@/content/menu";
import { requireAdmin } from "@/lib/auth";
import { TIER_COLUMNS, type TierRow } from "@/lib/memberships/tiers";
import { createServerSupabase } from "@/lib/supabase/server";
import { TierForm } from "./TierForm";

export const metadata: Metadata = {
  title: "Admin: Membership types",
  robots: { index: false, follow: false },
};

export default function AdminTiersPage() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <TiersAdmin />
    </Suspense>
  );
}

async function TiersAdmin() {
  await requireAdmin("/admin/tiers");
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("membership_tiers")
    .select(TIER_COLUMNS)
    .order("sort_order")
    .returns<TierRow[]>();
  if (error) throw error;
  const nextSortOrder =
    data.reduce((max, t) => Math.max(max, t.sort_order), 0) + 10;

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-600">
        Shown on the Memberships page and offered on the application and dues
        forms. Yearly dues set what members pay online (in full, or half by
        March 1 and half by June 1). Set dues to $0 to take a type off online
        payment. The small grey number is each type&apos;s order: lower numbers
        show first.
      </p>

      <details className="rounded-lg border border-green-800 bg-white p-4">
        <summary className="cursor-pointer font-semibold text-green-800">
          Add a membership type
        </summary>
        <div className="mt-4">
          <TierForm nextSortOrder={nextSortOrder} />
        </div>
      </details>

      <ul className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {data.map((tier) => (
          <li key={tier.id}>
            <details className="px-4 py-3">
              <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                <span className="font-medium">{tier.name}</span>
                {tier.is_sample && (
                  <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                    Sample
                  </span>
                )}
                <span className="ml-auto flex items-baseline gap-3">
                  <span
                    className="text-xs text-stone-400 tabular-nums"
                    title="Order"
                  >
                    #{tier.sort_order}
                  </span>
                  <span className="tabular-nums">
                    {tier.price_cents > 0
                      ? `${formatPrice(tier.price_cents)}/yr`
                      : "No online dues"}
                  </span>
                </span>
              </summary>
              <div className="mt-4">
                <TierForm tier={tier} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}
