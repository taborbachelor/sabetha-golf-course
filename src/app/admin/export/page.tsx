import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { isIsoDate, todayIn } from "@/lib/dates";
import { defaultExportRange } from "@/lib/export/range";
import { EXPORTS } from "@/lib/export/reports";
import { getSettings } from "@/lib/settings";
import { ExportForm } from "./ExportForm";

export const metadata: Metadata = {
  title: "Admin: Export",
  robots: { index: false, follow: false },
};

export default function AdminExportPage({
  searchParams,
}: PageProps<"/admin/export">) {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      {searchParams.then((params) => {
        const one = (key: string) => {
          const value = params[key];
          return typeof value === "string" ? value : undefined;
        };
        return (
          <ExportLoader
            from={one("from")}
            to={one("to")}
            error={one("error")}
          />
        );
      })}
    </Suspense>
  );
}

async function ExportLoader({
  from,
  to,
  error,
}: {
  from?: string;
  to?: string;
  error?: string;
}) {
  await requireAdmin("/admin/export");
  const { timeZone } = await getSettings();
  const today = todayIn(timeZone);
  const range = defaultExportRange(today);

  return (
    <div className="space-y-6">
      <p className="text-sm text-stone-600">
        Download spreadsheets (CSV, opens in Excel or Google Sheets) to match
        online payments against the Square dashboard. Everything is listed by
        the day it was paid; rounds also show the day they&apos;re for. Only
        completed payments are included. A refunded round shows an Amount of
        0.00 (the refund is in its own column), so each Amount column adds up to
        what Square kept.
      </p>
      <ExportForm
        kinds={Object.entries(EXPORTS).map(([kind, label]) => ({
          kind,
          label,
        }))}
        from={from && isIsoDate(from) ? from : range.from}
        to={to && isIsoDate(to) ? to : range.to}
        today={today}
        error={error}
      />
    </div>
  );
}
