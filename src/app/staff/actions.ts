"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { roleOf, safeNext } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";

/** email is echoed back so the field keeps its value after React resets the form. */
export type SignInState = { error?: string; email?: string };

const credentials = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success)
    return { error: "Enter your email and password.", email };

  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: "Wrong email or password.", email };

  if (!roleOf(data.user.app_metadata)) {
    await supabase.auth.signOut();
    return {
      error: "This account doesn't have staff access yet. Ask the club admin.",
      email,
    };
  }

  redirect(safeNext(formData.get("next")));
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect("/staff/login");
}
