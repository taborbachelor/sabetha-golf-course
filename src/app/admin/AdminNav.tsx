"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin", label: "Members" },
  { href: "/admin/settings", label: "Prices & hours" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/tiers", label: "Membership types" },
  { href: "/admin/carts", label: "Carts" },
  { href: "/admin/export", label: "Export" },
  { href: "/admin/signs", label: "QR signs" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const current = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={`chip min-h-10 text-sm ${current ? "chip-on" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
