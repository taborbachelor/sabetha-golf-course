import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { publicEnv } from "@/lib/env";

/**
 * Per-request client acting as the signed-in staff user (anon key + auth
 * cookies), so RLS applies. Use in Server Components, actions and routes.
 */
export async function createServerSupabase() {
  // Staff data is always per request. Without this, Partial Prefetching
  // treats cookies as part of the prerendered shell and Supabase's session
  // check (Date.now) breaks the prerender.
  await connection();
  const cookieStore = await cookies();
  const env = publicEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // The proxy refreshes the session instead.
          }
        },
      },
    },
  );
}
