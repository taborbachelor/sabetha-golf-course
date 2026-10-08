import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIn } from "@/lib/dates";
import { addDays, zonedTimeToUtc } from "@/lib/time";
import type { CartRow, RoundRow, SessionRow } from "./board";

export type BoardData = {
  today: string;
  rounds: RoundRow[];
  carts: CartRow[];
  sessions: SessionRow[];
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

  const [rounds, carts, sessions] = await Promise.all([
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
  ]);

  for (const r of [rounds, carts, sessions]) if (r.error) throw r.error;

  return {
    today,
    rounds: rounds.data as RoundRow[],
    carts: carts.data as CartRow[],
    sessions: sessions.data as SessionRow[],
  };
}
