"use client";

import { useActionState } from "react";
import type { ApplicationStatus } from "@/lib/memberships/application";
import { setApplicationStatus, type ApplicationState } from "./actions";

/** One application, with dates and dues already formatted by the page. */
export type ApplicationCard = {
  id: string;
  name: string;
  tier: string;
  cartShed: boolean;
  received: string;
  email: string;
  phone: string;
  address: string;
  status: ApplicationStatus;
  /** Dues payments with the same email, e.g. "First half $200.00, Oct 8". */
  paid: string[];
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

/**
 * New applications first; approved and declined ones folded away. One
 * action state for the whole list, so the confirmation stays on screen when
 * a card moves into Past applications.
 */
export function ApplicationsAdmin({
  newApps,
  pastApps,
  duesUrl,
}: {
  newApps: ApplicationCard[];
  pastApps: ApplicationCard[];
  duesUrl: string;
}) {
  const [state, action, pending] = useActionState<ApplicationState, FormData>(
    setApplicationStatus,
    {},
  );
  const card = (app: ApplicationCard) => (
    <Card
      key={app.id}
      app={app}
      action={action}
      pending={pending}
      duesUrl={duesUrl}
    />
  );

  return (
    <div className="mt-4 space-y-4">
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={`rounded-lg px-4 py-3 ${state.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800"}`}
        >
          {state.message}
        </p>
      )}
      {newApps.length === 0 ? (
        <p className="rounded-lg bg-stone-100 px-4 py-3">
          No new applications.
        </p>
      ) : (
        <ul className="space-y-3">{newApps.map(card)}</ul>
      )}
      {pastApps.length > 0 && (
        <details className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <summary className="cursor-pointer font-semibold">
            Past applications ({pastApps.length})
          </summary>
          <ul className="mt-3 space-y-3">{pastApps.map(card)}</ul>
        </details>
      )}
    </div>
  );
}

function Card({
  app,
  action,
  pending,
  duesUrl,
}: {
  app: ApplicationCard;
  action: (formData: FormData) => void;
  pending: boolean;
  duesUrl: string;
}) {
  return (
    <li
      aria-label={`Application from ${app.name}`}
      className="rounded-lg border border-stone-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">{app.name}</p>
          <p className="text-sm text-stone-600">
            {app.tier}
            {app.cartShed && " · wants a Cart Shed"} · received {app.received}
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
        <dd className="break-all">
          <a href={`mailto:${app.email}`} className="text-green-800 underline">
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

      {(app.status === "approved" || app.paid.length > 0) && (
        <div className="mt-3 space-y-1 rounded-md bg-stone-50 px-3 py-2 text-sm">
          {app.status === "approved" && (
            <p>
              <span className="font-medium">Next:</span> tell them to pay their
              dues at <span className="break-all">{duesUrl}</span>
            </p>
          )}
          {app.paid.length > 0 ? (
            <p className="text-green-900">
              <span className="font-medium">Paid:</span> {app.paid.join("; ")}
            </p>
          ) : (
            <p className="text-stone-600">
              No dues payment from this email yet.
            </p>
          )}
        </div>
      )}

      <form action={action} className="mt-3 flex flex-wrap gap-2">
        <input type="hidden" name="id" value={app.id} />
        {app.status === "submitted" ? (
          <>
            <StatusButton value="approved" pending={pending}>
              Approve
            </StatusButton>
            <StatusButton value="rejected" pending={pending}>
              Decline
            </StatusButton>
          </>
        ) : (
          <StatusButton value="submitted" pending={pending}>
            Mark as new
          </StatusButton>
        )}
      </form>
    </li>
  );
}

function StatusButton({
  value,
  pending,
  children,
}: {
  value: ApplicationStatus;
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      name="status"
      value={value}
      disabled={pending}
      className="chip min-h-10 text-sm disabled:opacity-50"
    >
      {children}
    </button>
  );
}
