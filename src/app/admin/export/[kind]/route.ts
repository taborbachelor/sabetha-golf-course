import type { NextRequest } from "next/server";
import { getStaffUser } from "@/lib/auth";
import { isIsoDate, todayIn } from "@/lib/dates";
import { EXPORTS, buildExport, type ExportKind } from "@/lib/export/reports";
import { getSettings } from "@/lib/settings";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * CSV download for reconciling with the POS / Square dashboard.
 * /admin/export/rounds?from=2026-10-01&to=2026-10-31 (club calendar days).
 * Admins only; reads run as the signed-in admin, so RLS applies.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/admin/export/[kind]">,
) {
  const user = await getStaffUser();
  if (!user || user.role !== "admin") {
    return new Response("Admins only", { status: 403 });
  }

  const { kind } = await ctx.params;
  if (!(kind in EXPORTS)) return new Response("Not found", { status: 404 });

  const { timeZone } = await getSettings();
  const today = todayIn(timeZone);
  const params = request.nextUrl.searchParams;
  const from = params.get("from") || `${today.slice(0, 8)}01`;
  const to = params.get("to") || today;
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
    return new Response("Use from/to dates like 2026-10-01, with from <= to", {
      status: 400,
    });
  }

  const { csv } = await buildExport(
    await createServerSupabase(),
    kind as ExportKind,
    { from, to },
    timeZone,
  );

  // The byte-order mark makes Excel read names with accents correctly.
  const BOM = String.fromCharCode(0xfeff);
  return new Response(BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sabetha-${kind}-${from}-to-${to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
