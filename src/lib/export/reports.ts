import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, zonedTimeToUtc } from "@/lib/time";
import { dollars, toCsv, type Cell } from "./csv";

export const EXPORTS = {
  rounds: "Pay to Play rounds",
  orders: "Order to the Course",
  dues: "Membership dues",
} as const;
export type ExportKind = keyof typeof EXPORTS;

export type DateRange = { from: string; to: string };

/** "2026-10-08 14:05" in the club's time zone. */
function stamp(iso: string, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

type OrderItem = { name: string; qty: number };

/** "2× Domestic beer (can); 1× Bottled water" */
export function itemsSummary(items: unknown): string {
  if (!Array.isArray(items)) return "";
  return (items as OrderItem[]).map((i) => `${i.qty}× ${i.name}`).join("; ");
}

/** Reads every matching row, a page at a time (Supabase caps one read at 1000). */
async function all<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const size = 1000;
  const rows: T[] = [];
  for (let start = 0; ; start += size) {
    const { data, error } = await page(start, start + size - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < size) return rows;
  }
}

export type RoundExportRow = {
  code: string;
  play_date: string;
  holes: number;
  players: number;
  carts: number;
  name: string;
  phone: string;
  email: string;
  arrival_time: string | null;
  amount_cents: number;
  status: string;
  payment_id: string | null;
  created_at: string;
};

export const ROUND_HEADERS = [
  "Code",
  "Paid at",
  "Play date",
  "Holes",
  "Players",
  "Carts",
  "Name",
  "Phone",
  "Email",
  "Arriving",
  "Amount",
  "Refunded",
  "Status",
  "Square payment ID",
];

/**
 * One rounds spreadsheet row. A refunded round's Amount is 0.00 (the money
 * went back) and the refunded sum is in its own column, so the Amount
 * column adds up to what Square kept.
 */
export function roundRow(r: RoundExportRow, timeZone: string): Cell[] {
  const refunded = r.status === "refunded";
  return [
    r.code,
    stamp(r.created_at, timeZone),
    r.play_date,
    r.holes,
    r.players,
    r.carts,
    r.name,
    r.phone,
    r.email,
    r.arrival_time,
    dollars(refunded ? 0 : r.amount_cents),
    refunded ? dollars(r.amount_cents) : "",
    r.status,
    r.payment_id,
  ];
}

/**
 * Builds one CSV for the date range (club calendar days, inclusive), every
 * kind by the day it was paid (rounds also list the day they're for). Only
 * paid (or later refunded) money is included, so totals match the Square
 * dashboard; abandoned checkouts are left out.
 */
export async function buildExport(
  db: SupabaseClient,
  kind: ExportKind,
  range: DateRange,
  timeZone: string,
): Promise<{ csv: string; count: number }> {
  const start = zonedTimeToUtc(range.from, "00:00", timeZone).toISOString();
  const end = zonedTimeToUtc(
    addDays(range.to, 1),
    "00:00",
    timeZone,
  ).toISOString();
  let headers: string[];
  let rows: Cell[][];

  if (kind === "rounds") {
    const data = await all<RoundExportRow>((a, b) =>
      db
        .from("rounds")
        .select(
          "code, play_date, holes, players, carts, name, phone, email, arrival_time, amount_cents, status, payment_id, created_at",
        )
        .in("status", ["paid", "refunded"])
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at")
        .range(a, b),
    );
    headers = ROUND_HEADERS;
    rows = data.map((r) => roundRow(r, timeZone));
  } else if (kind === "orders") {
    type O = {
      code: string;
      created_at: string;
      hole: number;
      name: string;
      phone: string;
      items: unknown;
      has_alcohol: boolean;
      total_cents: number;
      status: string;
      payment_id: string | null;
    };
    const data = await all<O>((a, b) =>
      db
        .from("orders")
        .select(
          "code, created_at, hole, name, phone, items, has_alcohol, total_cents, status, payment_id",
        )
        .in("status", ["new", "preparing", "out_for_delivery", "delivered"])
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at")
        .range(a, b),
    );
    headers = [
      "Code",
      "Ordered at",
      "Hole",
      "Name",
      "Phone",
      "Items",
      "21+",
      "Total",
      "Status",
      "Square payment ID",
    ];
    rows = data.map((o) => [
      o.code,
      stamp(o.created_at, timeZone),
      o.hole,
      o.name,
      o.phone,
      itemsSummary(o.items),
      o.has_alcohol ? "Yes" : "No",
      dollars(o.total_cents),
      o.status.replace(/_/g, " "),
      o.payment_id,
    ]);
  } else {
    type D = {
      created_at: string;
      member_name: string;
      email: string;
      installment: string;
      amount_cents: number;
      payment_id: string | null;
      membership_tiers: { name: string } | null;
    };
    const data = await all<D>((a, b) =>
      db
        .from("dues_payments")
        .select(
          "created_at, member_name, email, installment, amount_cents, payment_id, membership_tiers(name)",
        )
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at")
        .range(a, b)
        .returns<D[]>(),
    );
    const installment = {
      full: "In full",
      first: "First half",
      second: "Second half",
    } as Record<string, string>;
    headers = [
      "Paid at",
      "Member",
      "Email",
      "Membership",
      "Payment",
      "Amount",
      "Square payment ID",
    ];
    rows = data.map((d) => [
      stamp(d.created_at, timeZone),
      d.member_name,
      d.email,
      d.membership_tiers?.name ?? "",
      installment[d.installment] ?? d.installment,
      dollars(d.amount_cents),
      d.payment_id,
    ]);
  }

  return { csv: toCsv(headers, rows), count: rows.length };
}
