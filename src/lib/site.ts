/** Absolute base URL for metadata, sitemap and structured data. */
export function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return "http://localhost:3000";
}

/**
 * Search engines are blocked unless ALLOW_INDEXING=true. The club hasn't
 * adopted this site yet, so the demo must not be indexed under its name.
 * Turn on at go-live (Phase 4).
 */
export function allowIndexing(): boolean {
  return process.env.ALLOW_INDEXING === "true";
}
