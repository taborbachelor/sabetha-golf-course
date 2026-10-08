import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  ROUND_HEADERS,
  buildExport,
  roundRow,
  type RoundExportRow,
} from "./reports";

const TZ = "America/Chicago";

const round = (over: Partial<RoundExportRow> = {}): RoundExportRow => ({
  code: "R-ABC123",
  play_date: "2026-10-10",
  holes: 9,
  players: 2,
  carts: 1,
  name: "Pat Golfer",
  phone: "785-555-0100",
  email: "pat@example.com",
  arrival_time: "Now",
  amount_cents: 5500,
  status: "paid",
  payment_id: "sq-1",
  // 2026-10-08 09:05 in Kansas.
  created_at: "2026-10-08T14:05:00Z",
  ...over,
});

/** A stand-in for the Supabase query builder that records every call. */
function fakeDb(rows: unknown[]) {
  const calls: [string, ...unknown[]][] = [];
  const query: Record<string, unknown> = {};
  for (const method of [
    "select",
    "in",
    "gte",
    "lt",
    "lte",
    "order",
    "range",
    "returns",
  ]) {
    query[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return query;
    };
  }
  // Awaiting the query gives the rows (one page: fewer than 1000).
  query.then = (resolve: (r: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(resolve);
  const db = {
    from: (table: string) => {
      calls.push(["from", table]);
      return query;
    },
  } as unknown as SupabaseClient;
  return { db, calls };
}

describe("roundRow", () => {
  it("lists a paid round with when it was paid and the day it's for", () => {
    const row = roundRow(round(), TZ);
    expect(
      Object.fromEntries(ROUND_HEADERS.map((h, i) => [h, row[i]])),
    ).toMatchObject({
      "Paid at": "2026-10-08 09:05",
      "Play date": "2026-10-10",
      Amount: "55.00",
      Refunded: "",
      Status: "paid",
    });
    expect(row).toHaveLength(ROUND_HEADERS.length);
  });

  it("shows a refunded round as 0.00 so the Amount column sums to Square's net", () => {
    const row = roundRow(round({ status: "refunded" }), TZ);
    const col = (h: string) => row[ROUND_HEADERS.indexOf(h)];
    expect(col("Amount")).toBe("0.00");
    expect(col("Refunded")).toBe("55.00");
    expect(col("Status")).toBe("refunded");
  });
});

describe("buildExport", () => {
  it("picks rounds by payment time (club days), not play date", async () => {
    const { db, calls } = fakeDb([round(), round({ status: "refunded" })]);
    const { csv, count } = await buildExport(
      db,
      "rounds",
      { from: "2026-10-01", to: "2026-10-31" },
      TZ,
    );
    expect(count).toBe(2);
    expect(calls).toContainEqual([
      "gte",
      "created_at",
      "2026-10-01T05:00:00.000Z",
    ]);
    // Through the end of Oct 31 in Kansas (CDT ends Nov 1).
    expect(calls).toContainEqual([
      "lt",
      "created_at",
      "2026-11-01T05:00:00.000Z",
    ]);
    expect(
      calls.some(([m, col]) => m !== "select" && col === "play_date"),
    ).toBe(false);
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toBe(ROUND_HEADERS.join(","));
    expect(lines).toHaveLength(3);
  });

  it("still makes a file with just the headings when nothing matches", async () => {
    const { db } = fakeDb([]);
    const { csv, count } = await buildExport(
      db,
      "dues",
      { from: "2026-10-01", to: "2026-10-01" },
      TZ,
    );
    expect(count).toBe(0);
    expect(csv.trim().split("\r\n")).toHaveLength(1);
  });
});
