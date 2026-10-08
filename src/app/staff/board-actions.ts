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

/**
 * `at` is the timestamp an undoable step wrote (returned_at / updated_at).
 * Undo only reverses the row if it still carries exactly that stamp.
 */
export type BoardResult =
  { ok: true; at?: string } | { ok: false; message: string };

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
  const at = new Date().toISOString();
  const { data } = await db
    .from("cart_sessions")
    .update({ status: "returned", returned_at: at })
    .eq("id", sessionId)
    .eq("status", "out")
    .select("id");
  const result = done(data, STALE);
  return result.ok ? { ok: true, at } : result;
}

/** The tablet offers Undo for ~10 s; allow some slack for a slow network. */
const UNDO_WINDOW_MS = 60_000;
const TOO_LATE = "Too late to undo. Fix it on the board.";

function undoable(at: string): boolean {
  const t = Date.parse(at);
  return Number.isFinite(t) && Math.abs(Date.now() - t) <= UNDO_WINDOW_MS;
}

/**
 * Undo a Returned tap: the cart goes back to Out (same out_at). Only if the
 * session is still the one returned at `at`, and the cart hasn't been
 * rented again since.
 */
export async function undoReturned(
  sessionId: string,
  at: string,
): Promise<BoardResult> {
  if (!isUuid(sessionId) || !undoable(at)) {
    return { ok: false, message: TOO_LATE };
  }
  const db = await staffDb();
  const { data: session } = await db
    .from("cart_sessions")
    .select("cart_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (session?.cart_id) {
    const busy = await cartIsFree(db, session.cart_id);
    if (busy) return { ok: false, message: busy };
  }
  const { data } = await db
    .from("cart_sessions")
    .update({ status: "out", returned_at: null })
    .eq("id", sessionId)
    .eq("status", "returned")
    .eq("returned_at", at)
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

const ORDER_FROM = {
  preparing: "new",
  out_for_delivery: "preparing",
  delivered: "out_for_delivery",
} as const;

/**
 * Move an order one step: New -> Preparing -> On the way -> Delivered.
 * Only succeeds from the expected previous status.
 */
export async function advanceOrder(
  orderId: string,
  to: keyof typeof ORDER_FROM,
): Promise<BoardResult> {
  if (!isUuid(orderId) || !(to in ORDER_FROM)) {
    return { ok: false, message: STALE };
  }
  const db = await staffDb();
  const at = new Date().toISOString();
  const { data } = await db
    .from("orders")
    .update({ status: to, updated_at: at })
    .eq("id", orderId)
    .eq("status", ORDER_FROM[to])
    .select("id");
  const result = done(data, STALE);
  return result.ok ? { ok: true, at } : result;
}

/**
 * Undo a Delivered tap: back to On the way. Only if the order is still the
 * one marked delivered at `at`.
 */
export async function undoDelivered(
  orderId: string,
  at: string,
): Promise<BoardResult> {
  if (!isUuid(orderId) || !undoable(at)) {
    return { ok: false, message: TOO_LATE };
  }
  const db = await staffDb();
  const { data } = await db
    .from("orders")
    .update({
      status: "out_for_delivery",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "delivered")
    .eq("updated_at", at)
    .select("id");
  return done(data, STALE);
}

const KITCHEN = z.enum(["open", "drinks_only", "closed"]);

/** Kitchen open / Drinks only / Ordering closed. Any staff member. */
export async function setKitchenStatus(status: string): Promise<BoardResult> {
  const parsed = KITCHEN.safeParse(status);
  if (!parsed.success) return { ok: false, message: STALE };
  const db = await staffDb();
  const { data } = await db
    .from("settings")
    .update({ value: parsed.data, updated_at: new Date().toISOString() })
    .eq("key", "kitchen_status")
    .select("key");
  return done(data, "Couldn't change the kitchen status. Try again.");
}

/** Demo switch: take orders outside clubhouse hours. Admins only. */
export async function setIgnoreHoursForDemo(on: boolean): Promise<BoardResult> {
  const user = await requireStaff();
  if (user.role !== "admin") {
    return { ok: false, message: "Only an admin can change this." };
  }
  const db = await createServerSupabase();
  const { data } = await db
    .from("settings")
    .update({ value: on === true, updated_at: new Date().toISOString() })
    .eq("key", "ignore_hours_for_demo")
    .select("key");
  return done(data, "Couldn't change the demo setting. Try again.");
}
