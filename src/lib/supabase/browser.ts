import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/** Browser client for the staff tablet (auth session + Realtime). */
export function createBrowserSupabase() {
  const env = publicEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
