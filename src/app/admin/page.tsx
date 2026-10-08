import type { Metadata } from "next";
import { Suspense } from "react";
import { formatPrice } from "@/content/menu";
import { installmentLabels } from "@/content/memberships";
import { getSettings } from "@/lib/settings";
import { requireAdmin } from "@/lib/auth";
import type { ApplicationStatus } from "@/lib/memberships/application";
import type { Installment } from "@/lib/memberships/dues";
import { createServerSupabase } from "@/lib/supabase/server";
import { setApplicationStatus } from "./actions";

export const metadata: Metadata = {
  title: "Admin: Members",
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

const statusLabels: Record<ApplicationStatus, string> = {
  submitted: "New",
  approved: "Approved",
  rejected: "Declined",
};

const statusStyles: Record<ApplicationStatus, string> = {
  submitted: "bg-amber-100 text-amber-900",
  approved: "bg-green-100 text-green-900",
  rejected: "bg-stone-200 text-stone-700",
};

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
      .limit(100)
      .returns<DuesRow[]>(),
  ]);
  if (applications.error) throw applications.error;
  if (dues.error) throw dues.error;
  const data = applications.data;

  const newCount = data.filter((a) => a.status === "submitted").length;
  const received = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div>
      <section aria-labelledby="applications-heading">
        <h2 id="applications-heading" className="text-xl font-bold">
          Membership applications
          {newCount > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-sm font-medium text-amber-900">
              {newCount} new
            </span>
          )}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          From the form at /memberships/apply. Contact applicants directly;
          nothing is emailed from the site.
        </p>

        {data.length === 0 ? (
          <p className="mt-4 rounded-lg bg-stone-100 px-4 py-3">
            No applications yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.map((app) => (
              <li
                key={app.id}
                className="rounded-lg border border-stone-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{app.name}</p>
                    <p className="text-sm text-stone-600">
                      {app.membership_tiers?.name ?? "No type"}
                      {app.membership_tiers?.is_sample && " (sample)"}
                      {app.cart_shed && " · wants a Cart Shed"} · received{" "}
                      {received.format(new Date(app.created_at))}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${statusStyles[app.status]}`}
                  >
                    {statusLabels[app.status]}
                  </span>
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
                  <dt className="text-stone-600">Email</dt>
                  <dd>
                    <a
                      href={`mailto:${app.email}`}
                      className="text-green-800 underline"
                    >
                      {app.email}
                    </a>
                  </dd>
                  <dt className="text-stone-600">Phone</dt>
                  <dd>
                    <a
                      href={`tel:${app.phone.replace(/[^\d+]/g, "")}`}
                      className="text-green-800 underline"
                    >
                      {app.phone}
                    </a>
                  </dd>
                  <dt className="text-stone-600">Address</dt>
                  <dd className="whitespace-pre-line">{app.address}</dd>
                </dl>
                <form
                  action={setApplicationStatus}
                  className="mt-3 flex flex-wrap gap-2"
                >
                  <input type="hidden" name="id" value={app.id} />
                  {app.status === "submitted" ? (
                    <>
                      <button
                        type="submit"
                        name="status"
                        value="approved"
                        className="chip min-h-10 text-sm"
                      >
                        Approve
                      </button>
                      <button
                        type="submit"
                        name="status"
                        value="rejected"
                        className="chip min-h-10 text-sm"
                      >
                        Decline
                      </button>
                    </>
                  ) : (
                    <button
                      type="submit"
                      name="status"
                      value="submitted"
                      className="chip min-h-10 text-sm"
                    >
                      Mark as new
                    </button>
                  )}
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="dues-heading" className="mt-10">
        <h2 id="dues-heading" className="text-xl font-bold">
          Dues payments
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Paid online at /memberships/dues, newest first. Match them to members
          by name and email.
        </p>
        {dues.data.length === 0 ? (
          <p className="mt-4 rounded-lg bg-stone-100 px-4 py-3">
            No dues payments yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-stone-200 bg-white">
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
                {dues.data.map((d) => (
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
        )}
      </section>
    </div>
  );
}
