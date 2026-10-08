import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIn } from "@/lib/dates";
import { asKitchenStatus, effectiveKitchen } from "@/lib/orders/kitchen";
import type { KitchenStatus } from "@/lib/orders/order";
import { addDays, zonedTimeToUtc } from "@/lib/time";
import type { CartRow, OrderRow, RoundRow, SessionRow } from "./board";

export type BoardData = {
  today: string;
  rounds: RoundRow[];
  carts: CartRow[];
  sessions: SessionRow[];
  orders: OrderRow[];
  /** In effect right now: what staff set today, else the admin default. */
  kitchen: KitchenStatus;
  /** What the kitchen goes back to each morning (set in admin). */
  kitchenDefault: KitchenStatus;
  ignoreHoursForDemo: boolean;
};

/**
 * Everything the staff tablet shows, read as the signed-in staff user so
 * RLS applies. Works with the server client (first render) and the browser
 * client (live refreshes).
 */
export async function fetchBoard(
  db: SupabaseClient,
  timeZone: string,
): Promise<BoardData> {
  const today = todayIn(timeZone);
  const dayEnd = zonedTimeToUtc(
    addDays(today, 1),
    "00:00",
    timeZone,
  ).toISOString();

  const [rounds, carts, sessions, orders, settings] = await Promise.all([
    db
      .from("rounds")
      .select(
        "id, code, name, holes, players, carts, arrival_time, arrive_at, amount_cents, created_at",
      )
      .eq("play_date", today)
      .eq("status", "paid")
      .order("arrive_at", { ascending: true }),
    db.from("carts").select("id, number, active").order("number"),
    // Anything not returned yet that matters today: carts out now, plus
    // reservations up to the end of today.
    db
      .from("cart_sessions")
      .select(
        "id, cart_id, round_id, name, holes, status, reserved_for, out_at, source",
      )
      .in("status", ["reserved", "ready", "out"])
      .or(`status.eq.out,reserved_for.lt.${dayEnd}`),
    // Paid orders the kitchen still has to deal with.
    db
      .from("orders")
      .select(
        "id, code, hole, name, phone, items, total_cents, has_alcohol, status, created_at",
      )
      .in("status", ["new", "preparing", "out_for_delivery"])
      .order("created_at", { ascending: true }),
    db
      .from("settings")
      .select("key, value, updated_at")
      .in("key", [
        "kitchen_status",
        "kitchen_default",
        "ignore_hours_for_demo",
      ]),
  ]);

  for (const r of [rounds, carts, sessions, orders, settings]) {
    if (r.error) throw r.error;
  }

  const row = (key: string) => settings.data!.find((s) => s.key === key);
  const value = (key: string) => row(key)?.value as unknown;
  const kitchenDefault = asKitchenStatus(value("kitchen_default"), "open");

  return {
    today,
    rounds: rounds.data as RoundRow[],
    carts: carts.data as CartRow[],
    sessions: sessions.data as SessionRow[],
    orders: orders.data as OrderRow[],
    kitchen: effectiveKitchen({
      status: value("kitchen_status"),
      setAt: row("kitchen_status")?.updated_at,
      defaultStatus: kitchenDefault,
      timeZone,
    }),
    kitchenDefault,
    ignoreHoursForDemo: value("ignore_hours_for_demo") === true,
  };
}
