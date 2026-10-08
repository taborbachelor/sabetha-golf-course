"use client";

import { useEffect, useState } from "react";

type Kind = { kind: string; label: string };

/**
 * Date range plus one download button per spreadsheet. The To date can't be
 * picked before From, and each button says how many rows it would download.
 */
export function ExportForm({
  kinds,
  from: initialFrom,
  to: initialTo,
  today,
  error,
}: {
  kinds: Kind[];
  from: string;
  to: string;
  today: string;
  error?: string;
}) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  // Row counts for the dates they were fetched for.
  const [counts, setCounts] = useState<{
    key: string;
    byKind: Record<string, number>;
  } | null>(null);
  const backwards = !!from && !!to && to < from;
  const rangeKey = `${from}|${to}`;

  useEffect(() => {
    if (!from || !to || to < from) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const query = new URLSearchParams({ from, to, count: "1" });
        const entries = await Promise.all(
          kinds.map(async ({ kind }) => {
            const res = await fetch(`/admin/export/${kind}?${query}`, {
              signal: abort.signal,
            });
            const body = (await res.json()) as { count?: number };
            return [kind, body.count ?? -1] as const;
          }),
        );
        setCounts({
          key: `${from}|${to}`,
          byKind: Object.fromEntries(entries),
        });
      } catch {
        // Counts are a nicety; the downloads work without them.
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [from, to, kinds]);

  const countFor = (kind: string) =>
    counts?.key === rangeKey ? counts.byKind[kind] : undefined;

  return (
    <form method="get" action="/admin/export/rounds" className="space-y-6">
      {error && !backwards && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-red-800">
          {error}
        </p>
      )}
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-2 text-lg font-bold">Dates</legend>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">From</span>
          <input
            type="date"
            name="from"
            value={from}
            max={to || today}
            onChange={(e) => setFrom(e.target.value)}
            required
            className="input py-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">To</span>
          <input
            type="date"
            name="to"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            required
            aria-invalid={backwards || undefined}
            className="input py-2"
          />
        </label>
      </fieldset>
      {backwards && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-red-800">
          The To date is before the From date. Pick a To date on or after From.
        </p>
      )}
      <ul className="space-y-3">
        {kinds.map(({ kind, label }) => {
          const count = countFor(kind);
          return (
            <li key={kind} className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                formAction={`/admin/export/${kind}`}
                disabled={backwards}
                className="rounded-lg bg-green-800 px-4 py-2.5 font-semibold text-white hover:bg-green-900 disabled:bg-stone-400"
              >
                Download {label}
              </button>
              <span className="text-sm text-stone-600" aria-live="polite">
                {count === undefined || count < 0 || backwards
                  ? ""
                  : count === 0
                    ? "Nothing paid in these dates; the file will only have the column headings."
                    : `${count} ${count === 1 ? "row" : "rows"}`}
              </span>
            </li>
          );
        })}
      </ul>
    </form>
  );
}
