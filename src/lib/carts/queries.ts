import "server-only";
import type { Settings } from "@/content/settings";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  heldCarts,
  overlaps,
  type CartSessionRow,
  type Window,
} from "./availability";

/**
 * Active carts minus carts held during `window`. Can go negative when two
 * checkouts race for the last cart; checkout re-checks after holding carts
 * and backs out if so. Holds from checkouts that never finished paying
 * expire (see heldCarts).
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
      .select(
        "holes, status, reserved_for, out_at, round:rounds(status, created_at)",
      )
      .in("status", ["reserved", "ready", "out"]),
  ]);
  if (carts.error) throw carts.error;
  if (sessions.error) throw sessions.error;

  const held = heldCarts(
    sessions.data as unknown as CartSessionRow[],
    roundMinutes,
  );
  return (carts.count ?? 0) - held.filter((h) => overlaps(h, window)).length;
}

/** How many carts can still be reserved online for `window`. */
export async function availableCartCount(
  window: Window,
  roundMinutes: Settings["roundMinutes"],
): Promise<number> {
  return Math.max(0, await cartBalance(window, roundMinutes));
}
