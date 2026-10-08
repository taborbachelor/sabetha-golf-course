import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";

export type StaffRole = "staff" | "admin";

export type StaffUser = { id: string; email: string; role: StaffRole };

/** Role lives in app_metadata, which only the service role can change. */
export function roleOf(appMetadata: Record<string, unknown> | undefined) {
  const role = appMetadata?.role;
  return role === "staff" || role === "admin" ? role : null;
}

/** The signed-in staff member, or null (not signed in, or no staff role). */
export async function getStaffUser(): Promise<StaffUser | null> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = roleOf(user?.app_metadata);
  if (!user || !role) return null;
  return { id: user.id, email: user.email ?? "", role };
}

/** Use at the top of staff pages and actions. Redirects if not allowed. */
export async function requireStaff(next = "/staff"): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) redirect(`/staff/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireAdmin(next = "/admin"): Promise<StaffUser> {
  const user = await requireStaff(next);
  if (user.role !== "admin") redirect("/staff");
  return user;
}

/** Only allow redirects back into the staff/admin area. */
export function safeNext(next: unknown): string {
  return typeof next === "string" && /^\/(staff|admin)(\/|$|\?)/.test(next)
    ? next
    : "/staff";
}
