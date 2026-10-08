import { afterEach, describe, expect, it, vi } from "vitest";
import { allowIndexing, siteUrl } from "./site";

afterEach(() => vi.unstubAllEnvs());

describe("siteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://example.com");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "x.vercel.app");
    expect(siteUrl()).toBe("https://example.com");
  });

  it("falls back to the Vercel production URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "x.vercel.app");
    expect(siteUrl()).toBe("https://x.vercel.app");
  });
});

describe("allowIndexing", () => {
  it("is off unless explicitly true", () => {
    vi.stubEnv("ALLOW_INDEXING", "");
    expect(allowIndexing()).toBe(false);
    vi.stubEnv("ALLOW_INDEXING", "true");
    expect(allowIndexing()).toBe(true);
  });
});
