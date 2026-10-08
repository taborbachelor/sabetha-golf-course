import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatPrice } from "@/content/menu";
import { installmentLabels } from "@/content/memberships";
import { getSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth";
import type { ApplicationStatus } from "@/lib/memberships/application";
import type { Installment } from "@/lib/memberships/dues";
import { createServerSupabase } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";
import { ApplicationsAdmin, type ApplicationCard } from "./ApplicationsAdmin";
import { duesByEmail, emailKey } from "./dues-match";

export const metadata: Metadata = {
  title: "Admin: Applications & dues",
  robots: { index: false, follow: false },
};

type ApplicationRow = {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  cart_shed: boolean;
  status: ApplicationStatus;
  created_at: string;
  membership_tiers: { name: string; is_sample: boolean } | null;
};

type DuesRow = {
  id: string;
  member_name: string;
  email: string;
  installment: Installment;
  amount_cents: number;
  payment_id: string | null;
  created_at: string;
  membership_tiers: { name: string } | null;
};

/** Most dues payments listed here; Export has the rest. */
const DUES_SHOWN = 100;

export default function AdminPage() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  await requireAdmin("/admin");
  const { timeZone } = await getSettings();
  const supabase = await createServerSupabase();
  const [applications, dues] = await Promise.all([
    supabase
      .from("membership_applications")
      .select(
        "id, name, address, phone, email, cart_shed, status, created_at, membership_tiers(name, is_sample)",
      )
      .order("created_at", { ascending: false })
      .returns<ApplicationRow[]>(),
    supabase
      .from("dues_payments")
      .select(
        "id, member_name, email, installment, amount_cents, payment_id, created_at, membership_tiers(name)",
      )
      .order("created_at", { ascending: false })
      .limit(DUES_SHOWN + 1)
      .returns<DuesRow[]>(),
  ]);
  if (applications.error) throw applications.error;
  if (dues.error) throw dues.error;
  const shownDues = dues.data.slice(0, DUES_SHOWN);
  const moreDues = dues.data.length > DUES_SHOWN;

  const received = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const shortDate = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  });
  const paidBy = duesByEmail(dues.data);
  const cards: ApplicationCard[] = applications.data.map((app) => ({
    id: app.id,
    name: app.name,
    tier:
      (app.membership_tiers?.name ?? "No type") +
      (app.membership_tiers?.is_sample ? " (sample)" : ""),
    cartShed: app.cart_shed,
    received: received.format(new Date(app.created_at)),
    email: app.email,
    phone: app.phone,
    address: app.address,
    status: app.status,
    paid: (paidBy.get(emailKey(app.email)) ?? []).map(
      (d) =>
        `${installmentLabels[d.installment].label} ${formatPrice(d.amount_cents)}, ${shortDate.format(new Date(d.created_at))}`,
    ),
  }));
  const newApps = cards.filter((a) => a.status === "submitted");

  return (
    <div>
      <section aria-labelledby="applications-heading">
        <h2 id="applications-heading" className="text-xl font-bold">
          Membership applications
          {newApps.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-sm font-medium text-amber-900">
              {newApps.length} new
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          From the form at /memberships/apply. Contact applicants directly;
          nothing is emailed from the site.
        </p>
        <ApplicationsAdmin
          newApps={newApps}
          pastApps={cards.filter((a) => a.status !== "submitted")}
          duesUrl={new URL("/memberships/dues", siteUrl()).href}
        />
      </section>

      <section aria-labelledby="dues-heading" className="mt-10">
        <h2 id="dues-heading" className="text-xl font-bold">
          Dues payments
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Paid online at /memberships/dues, newest first. Match them to members
          by name and email.
        </p>
        {shownDues.length === 0 ? (
          <p className="mt-4 rounded-lg bg-stone-100 px-4 py-3">
            No dues payments yet.
          </p>
        ) : (
          <>
            {/* Phones: one stacked card per payment, amount on top. */}
            <ul className="mt-4 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white sm:hidden">
              {shownDues.map((d) => (
                <li key={d.id} className="px-3 py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{d.member_name}</span>
                    <span className="font-semibold tabular-nums">
                      {formatPrice(d.amount_cents)}
                    </span>
                  </div>
                  <p className="break-all text-stone-600">{d.email}</p>
                  <p className="text-stone-600">
                    {installmentLabels[d.installment].label} ·{" "}
                    {d.membership_tiers?.name ?? "No type"} ·{" "}
                    {received.format(new Date(d.created_at))}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-4 hidden overflow-x-auto rounded-lg border border-stone-200 bg-white sm:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-stone-50 text-stone-600">
                  <tr>
                    <th className="px-3 py-2 font-medium">Paid</th>
                    <th className="px-3 py-2 font-medium">Member</th>
                    <th className="px-3 py-2 font-medium">Membership</th>
                    <th className="px-3 py-2 font-medium">Payment</th>
                    <th className="px-3 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {shownDues.map((d) => (
                    <tr key={d.id}>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {received.format(new Date(d.created_at))}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{d.member_name}</span>
                        <span className="block text-stone-600">{d.email}</span>
                      </td>
                      <td className="px-3 py-2">
                        {d.membership_tiers?.name ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {installmentLabels[d.installment].label}
                      </td>
                      <td className="px-3 py-2 text-right font-medium">
                        {formatPrice(d.amount_cents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {moreDues && (
              <p className="mt-2 text-sm text-stone-600">
                Showing the latest {DUES_SHOWN} — use{" "}
                <Link href="/admin/export" className="text-green-800 underline">
                  Export
                </Link>{" "}
                for the full list.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}
