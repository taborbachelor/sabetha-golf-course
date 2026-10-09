import type { MetadataRoute } from "next";
import { moreLinks, navItems } from "@/lib/nav";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ["/", ...[...navItems, ...moreLinks].map((item) => item.href)].map(
    (path) => ({ url: new URL(path, base).toString() }),
  );
}
