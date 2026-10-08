import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIn } from "@/lib/dates";
import type { KitchenStatus } from "@/lib/orders/order";
import { addDays, zonedTimeToUtc } from "@/lib/time";
import type { CartRow, OrderRow, RoundRow, SessionRow } from "./board";

export type BoardData = {
  today: string;
  rounds: RoundRow[];
  carts: CartRow[];
  sessions: SessionRow[];
  orders: OrderRow[];
  kitchen: KitchenStatus;
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
      .select("key, value")
      .in("key", ["kitchen_status", "ignore_hours_for_demo"]),
  ]);

  for (const r of [rounds, carts, sessions, orders, settings]) {
    if (r.error) throw r.error;
  }

  const value = (key: string) =>
    settings.data!.find((s) => s.key === key)?.value as unknown;
  const kitchen = value("kitchen_status");

  return {
    today,
    rounds: rounds.data as RoundRow[],
    carts: carts.data as CartRow[],
    sessions: sessions.data as SessionRow[],
    orders: orders.data as OrderRow[],
    kitchen:
      kitchen === "open" || kitchen === "drinks_only" ? kitchen : "closed",
    ignoreHoursForDemo: value("ignore_hours_for_demo") === true,
  };
}
