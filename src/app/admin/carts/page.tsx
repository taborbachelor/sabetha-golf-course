import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { CartsAdmin } from "./CartsAdmin";

export const metadata: Metadata = {
  title: "Admin: Carts",
  robots: { index: false, follow: false },
};

export default function AdminCartsPage() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <CartsLoader />
    </Suspense>
  );
}

async function CartsLoader() {
  await requireAdmin("/admin/carts");
  const supabase = await createServerSupabase();
  const [carts, sessions] = await Promise.all([
    supabase.from("carts").select("id, number, active").order("number"),
    supabase
      .from("cart_sessions")
      .select("cart_id")
      .in("status", ["reserved", "ready", "out"])
      .not("cart_id", "is", null),
  ]);
  if (carts.error) throw carts.error;
  if (sessions.error) throw sessions.error;
  const inUse = new Set(sessions.data.map((s) => s.cart_id));

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-600">
        Rental carts on the Clubhouse board. Carts in service are what Pay to
        Play can reserve online, so taking one out (flat tire, in the shop)
        lowers online availability straight away. The cart count is a sample
        until the club confirms its fleet.
      </p>
      <CartsAdmin
        carts={carts.data.map((c) => ({ ...c, inUse: inUse.has(c.id) }))}
      />
    </div>
  );
}
