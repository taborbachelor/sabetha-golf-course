import { z } from "zod";

/**
 * Environment access, validated on first use rather than at import so
 * builds (and CI) work without secrets. Server-only values must never be
 * read from client components.
 */

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SQUARE_APPLICATION_ID: z.string().min(1),
  NEXT_PUBLIC_SQUARE_LOCATION_ID: z.string().min(1),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SQUARE_ENVIRONMENT: z.literal("sandbox", {
    error: "SQUARE_ENVIRONMENT must be 'sandbox' until Phase 4",
  }),
  SQUARE_ACCESS_TOKEN: z.string().min(1),
  SQUARE_LOCATION_ID: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export function publicEnv(): PublicEnv {
  // NEXT_PUBLIC_* must be referenced literally so Next inlines them in the browser bundle.
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SQUARE_APPLICATION_ID:
      process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID,
    NEXT_PUBLIC_SQUARE_LOCATION_ID: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID,
  });
}

export function serverEnv(): ServerEnv {
  return serverSchema.parse(process.env);
}
