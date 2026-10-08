"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isUuid } from "@/lib/codes";
import { createServerSupabase } from "@/lib/supabase/server";

export type CartAdminState = { ok?: boolean; message?: string };

/**
 * Add a rental cart (next number), or take one out of / back into service.
 * Online cart availability counts carts in service, so this is the club's
 * cart count. Runs as the signed-in admin ("admin write carts" policy).
 */
export async function updateCarts(
  _prev: CartAdminState,
  formData: FormData,
): Promise<CartAdminState> {
  await requireAdmin("/admin/carts");
  const supabase = await createServerSupabase();
  const intent = formData.get("intent");

  if (intent === "add") {
    const { data: last } = await supabase
      .from("carts")
      .select("number")
      .order("number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const number = (last?.number ?? 0) + 1;
    const { error } = await supabase.from("carts").insert({ number });
    if (error) return { message: "Couldn't add a cart. Please try again." };
    revalidatePath("/admin/carts");
    return { ok: true, message: `Added cart ${number}.` };
  }

  const id = formData.get("id");
  if (!isUuid(id) || (intent !== "retire" && intent !== "restore")) {
    return { message: "Something went wrong. Refresh the page." };
  }

  if (intent === "retire") {
    // Don't pull a cart that's reserved, waiting or out on the course.
    const { count, error } = await supabase
      .from("cart_sessions")
      .select("id", { count: "exact", head: true })
      .eq("cart_id", id)
      .in("status", ["reserved", "ready", "out"]);
    if (error) return { message: "Couldn't check the cart. Please try again." };
    if (count) {
      return {
        message:
          "That cart is in use right now. Mark it returned on the Clubhouse board first.",
      };
    }
  }

  const active = intent === "restore";
  const { data, error } = await supabase
    .from("carts")
    .update({ active })
    .eq("id", id)
    .select("number");
  if (error || data.length === 0) {
    return { message: "Couldn't save. Please try again." };
  }
  revalidatePath("/admin/carts");
  return {
    ok: true,
    message: `Cart ${data[0].number} is ${active ? "back in service" : "out of service"}.`,
  };
}
