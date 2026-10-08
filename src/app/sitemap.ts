import type { MetadataRoute } from "next";
import { navItems } from "@/lib/nav";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ["/", ...navItems.map((item) => item.href)].map((path) => ({
    url: new URL(path, base).toString(),
  }));
}
