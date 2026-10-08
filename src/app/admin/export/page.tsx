import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { EXPORTS } from "@/lib/export/reports";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Admin: Export",
  robots: { index: false, follow: false },
};

export default function AdminExportPage() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <ExportForm />
    </Suspense>
  );
}

async function ExportForm() {
  await requireAdmin("/admin/export");
  const { timeZone } = await getSettings();
  const today = todayIn(timeZone);

  return (
    <form method="get" action="/admin/export/rounds" className="space-y-6">
      <p className="text-sm text-stone-600">
        Download spreadsheets (CSV, opens in Excel or Google Sheets) to match
        online payments against the Square dashboard. Only completed payments
        are included. Rounds are listed by the day they&apos;re for; orders and
        dues by the day they were paid.
      </p>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-2 text-lg font-bold">Dates</legend>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">From</span>
          <input
            type="date"
            name="from"
            defaultValue={`${today.slice(0, 8)}01`}
            required
            className="input py-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">To</span>
          <input
            type="date"
            name="to"
            defaultValue={today}
            required
            className="input py-2"
          />
        </label>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        {Object.entries(EXPORTS).map(([kind, label]) => (
          <button
            key={kind}
            type="submit"
            formAction={`/admin/export/${kind}`}
            className="rounded-lg bg-green-800 px-4 py-2.5 font-semibold text-white hover:bg-green-900"
          >
            Download {label}
          </button>
        ))}
      </div>
    </form>
  );
}
