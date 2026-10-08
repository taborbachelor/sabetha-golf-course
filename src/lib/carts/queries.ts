import "server-only";
import type { Holes, Settings } from "@/content/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { overlaps, type HeldCart, type Window } from "./availability";

type SessionRow = {
  holes: Holes;
  status: "reserved" | "ready" | "out";
  reserved_for: string | null;
  out_at: string | null;
};

/**
 * Active carts minus carts held during `window`. Can go negative when two
 * checkouts race for the last cart; checkout re-checks after holding carts
 * and backs out if so.
 */
export async function cartBalance(
  window: Window,
  roundMinutes: Settings["roundMinutes"],
): Promise<number> {
  const db = createAdminClient();

  const [carts, sessions] = await Promise.all([
    db
      .from("carts")
      .select("id", { count: "exact", head: true })
      .eq("active", true),
    db
      .from("cart_sessions")
      .select("holes, status, reserved_for, out_at")
      .in("status", ["reserved", "ready", "out"]),
  ]);
  if (carts.error) throw carts.error;
  if (sessions.error) throw sessions.error;

  const held: HeldCart[] = (sessions.data as SessionRow[]).flatMap((s) => {
    const startIso =
      s.status === "out" ? (s.out_at ?? s.reserved_for) : s.reserved_for;
    if (!startIso) return [];
    const start = new Date(startIso);
    // A cart that's out stays unavailable until it's marked Returned, even if late.
    const expectedEnd = start.getTime() + roundMinutes[s.holes] * 60_000;
    const end = new Date(
      s.status === "out" ? Math.max(expectedEnd, Date.now()) : expectedEnd,
    );
    return [{ start, end }];
  });

  return (carts.count ?? 0) - held.filter((h) => overlaps(h, window)).length;
}

/** How many carts can still be reserved online for `window`. */
export async function availableCartCount(
  window: Window,
  roundMinutes: Settings["roundMinutes"],
): Promise<number> {
  return Math.max(0, await cartBalance(window, roundMinutes));
}
