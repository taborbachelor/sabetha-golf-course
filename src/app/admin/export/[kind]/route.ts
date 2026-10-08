import type { NextRequest } from "next/server";
import { getStaffUser } from "@/lib/auth";
import { todayIn } from "@/lib/dates";
import { parseExportRange } from "@/lib/export/range";
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
  const params = request.nextUrl.searchParams;
  const parsed = parseExportRange(
    params.get("from"),
    params.get("to"),
    todayIn(timeZone),
  );
  if (!parsed.ok) {
    // Back to the form with the reason, not a bare error page.
    const back = new URL("/admin/export", request.nextUrl);
    for (const key of ["from", "to"]) {
      const value = params.get(key);
      if (value) back.searchParams.set(key, value);
    }
    back.searchParams.set("error", parsed.message);
    return Response.redirect(back, 303);
  }
  const { from, to } = parsed.range;

  const { csv, count } = await buildExport(
    await createServerSupabase(),
    kind as ExportKind,
    { from, to },
    timeZone,
  );

  // ?count=1: how many rows the file would have, so the form can say so.
  if (params.get("count") === "1") {
    return Response.json(
      { count },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

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
