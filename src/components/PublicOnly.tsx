"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { chromeFor } from "@/lib/nav";

/** Renders its children (the site footer) everywhere except the staff pages. */
export function PublicOnly({ children }: { children: ReactNode }) {
  return chromeFor(usePathname()) === "full" ? children : null;
}
