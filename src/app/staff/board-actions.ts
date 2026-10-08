"use server";

import { z } from "zod";
import { requireStaff } from "@/lib/auth";
import { isUuid } from "@/lib/codes";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Staff tablet actions. Each one checks the staff role, runs as that staff
 * user (RLS applies), and only moves a session along a valid step, so a
 * stale screen or a double tap can't put a cart in a nonsense state.
 */

export type BoardResult = { ok: true } | { ok: false; message: string };

const ACTIVE = ["reserved", "ready", "out"];

async function staffDb() {
  await requireStaff();
  return createServerSupabase();
}

const done = (rows: unknown[] | null, stale: string): BoardResult =>
  rows && rows.length > 0 ? { ok: true } : { ok: false, message: stale };

const STALE = "That changed on another screen. The board has been refreshed.";

async function cartIsFree(
  db: Awaited<ReturnType<typeof staffDb>>,
  cartId: string,
): Promise<string | null> {
  const [cart, inUse] = await Promise.all([
    db.from("carts").select("number, active").eq("id", cartId).maybeSingle(),
    db
      .from("cart_sessions")
      .select("id", { count: "exact", head: true })
      .eq("cart_id", cartId)
      .in("status", ACTIVE),
  ]);
  if (!cart.data?.active) return "That cart isn't in service.";
  if ((inUse.count ?? 0) > 0)
    return `Cart ${cart.data.number} is already in use.`;
  return null;
}

/** Online reservation: staff pick which cart gets the key and the sign. */
export async function assignCart(
  sessionId: string,
  cartId: string,
): Promise<BoardResult> {
  if (!isUuid(sessionId) || !isUuid(cartId))
    return { ok: false, message: STALE };
  const db = await staffDb();
  const busy = await cartIsFree(db, cartId);
  if (busy) return { ok: false, message: busy };
  const { data } = await db
    .from("cart_sessions")
    .update({ cart_id: cartId })
    .eq("id", sessionId)
    .eq("status", "reserved")
    .is("cart_id", null)
    .select("id");
  return done(data, STALE);
}

/** Key in, "Reserved for ___" sign placed. */
export async function markReady(sessionId: string): Promise<BoardResult> {
  if (!isUuid(sessionId)) return { ok: false, message: STALE };
  const db = await staffDb();
  const { data } = await db
    .from("cart_sessions")
    .update({ status: "ready" })
    .eq("id", sessionId)
    .eq("status", "reserved")
    .not("cart_id", "is", null)
    .select("id");
  return done(data, STALE);
}

/** Golfer drove off. */
export async function markOut(sessionId: string): Promise<BoardResult> {
  if (!isUuid(sessionId)) return { ok: false, message: STALE };
  const db = await staffDb();
  const { data } = await db
    .from("cart_sessions")
    .update({ status: "out", out_at: new Date().toISOString() })
    .eq("id", sessionId)
    .in("status", ["reserved", "ready"])
    .not("cart_id", "is", null)
    .select("id");
  return done(data, STALE);
}

/** Cart came back. */
export async function markReturned(sessionId: string): Promise<BoardResult> {
  if (!isUuid(sessionId)) return { ok: false, message: STALE };
  const db = await staffDb();
  const { data } = await db
    .from("cart_sessions")
    .update({ status: "returned", returned_at: new Date().toISOString() })
    .eq("id", sessionId)
    .eq("status", "out")
    .select("id");
  return done(data, STALE);
}

/** Take the cart back off a reservation that hasn't left (wrong cart, no-show). */
export async function unassignCart(sessionId: string): Promise<BoardResult> {
  if (!isUuid(sessionId)) return { ok: false, message: STALE };
  const db = await staffDb();
  const { data } = await db
    .from("cart_sessions")
    .update({ cart_id: null, status: "reserved" })
    .eq("id", sessionId)
    .in("status", ["reserved", "ready"])
    .select("id");
  return done(data, STALE);
}

const walkIn = z.object({
  name: z.string().trim().min(1, "Enter a name").max(80),
  cartId: z.string().refine(isUuid, "Pick a cart"),
  holes: z.union([z.literal(9), z.literal(18)]),
});

/**
 * Walk-in rental. Payment is taken at the counter (POS); this replaces the
 * paper cart sheet.
 */
export async function rentWalkIn(input: {
  name: string;
  cartId: string;
  holes: number;
}): Promise<BoardResult> {
  const parsed = walkIn.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const db = await staffDb();
  const busy = await cartIsFree(db, parsed.data.cartId);
  if (busy) return { ok: false, message: busy };

  const now = new Date().toISOString();
  const { error } = await db.from("cart_sessions").insert({
    cart_id: parsed.data.cartId,
    name: parsed.data.name,
    holes: parsed.data.holes,
    status: "out",
    reserved_for: now,
    out_at: now,
    source: "walkin",
  });
  return error
    ? { ok: false, message: "Couldn't save the rental. Try again." }
    : { ok: true };
}
