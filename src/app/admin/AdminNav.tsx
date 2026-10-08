"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const tabs = [
  { href: "/admin", label: "Applications & dues" },
  { href: "/admin/settings", label: "Prices & hours" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/tiers", label: "Membership types" },
  { href: "/admin/carts", label: "Carts" },
  { href: "/admin/export", label: "Export" },
  { href: "/admin/signs", label: "QR signs" },
] as const;

/** One row of tabs; on a phone it scrolls sideways, current tab in view. */
export function AdminNav() {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    const row = nav.current;
    const current = row?.querySelector<HTMLElement>("[aria-current=page]");
    if (!row || !current) return;
    // Scroll the row only (scrollIntoView could also scroll the page).
    const left = current.offsetLeft;
    if (
      left < row.scrollLeft ||
      left + current.offsetWidth > row.scrollLeft + row.clientWidth
    ) {
      row.scrollLeft = left - (row.clientWidth - current.offsetWidth) / 2;
    }
  }, [pathname]);

  return (
    <nav
      ref={nav}
      aria-label="Admin sections"
      className="relative -mx-4 flex [scrollbar-width:thin] gap-2 overflow-x-auto px-4 pb-1"
    >
      {tabs.map((tab) => {
        const current = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current ? "page" : undefined}
            className={`chip min-h-10 shrink-0 text-sm whitespace-nowrap ${current ? "chip-on" : ""}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
