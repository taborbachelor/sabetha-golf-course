import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getSettings } from "@/content/settings";
import { requireAdmin } from "@/lib/auth";
import type { ApplicationStatus } from "@/lib/memberships/application";
import { createServerSupabase } from "@/lib/supabase/server";
import { setApplicationStatus } from "./actions";

export const metadata: Metadata = {
  title: "Admin",
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
    <div className="mx-auto w-full max-w-4xl px-4 py-6">
      <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
        <AdminHome />
      </Suspense>
    </div>
  );
}

async function AdminHome() {
  await requireAdmin("/admin");
  const { timeZone } = getSettings();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("membership_applications")
    .select(
      "id, name, address, phone, email, cart_shed, status, created_at, membership_tiers(name, is_sample)",
    )
    .order("created_at", { ascending: false })
    .returns<ApplicationRow[]>();
  if (error) throw error;

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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Admin</h1>
        <Link href="/staff" className="chip min-h-10 text-sm">
          Back to Clubhouse
        </Link>
      </div>

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
    </div>
  );
}
