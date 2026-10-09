export type NavItem = {
  href: string;
  label: string;
  /** Shown as a button: the main thing visitors come to do. */
  primary?: boolean;
};

/** Main site navigation. Every href must have a page under src/app. */
export const navItems: NavItem[] = [
  { href: "/pay", label: "Pay to Play", primary: true },
  { href: "/golf", label: "Golf" },
  { href: "/memberships", label: "Memberships" },
  { href: "/menu", label: "Menu" },
  { href: "/pool", label: "Pool" },
  { href: "/events", label: "Events" },
  { href: "/clubhouse-rental", label: "Clubhouse Rental" },
  { href: "/gift-cards", label: "Gift Cards" },
  { href: "/contact", label: "Contact" },
];

/** Other public pages: in the footer and the sitemap, not the main menu. */
export const moreLinks: NavItem[] = [
  { href: "/order", label: "Order to the Course" },
  { href: "/memberships/dues", label: "Pay Dues" },
];

/**
 * True when `href` is the page at `pathname` or a section it belongs to
 * (/memberships for /memberships/apply). "/" only matches itself.
 */
export function isCurrent(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Site chrome on the staff tablet: none on the board itself (a stray tap
 * mustn't leave it), just the club name on the sign-in page. /admin keeps
 * the normal site header.
 */
export function chromeFor(
  pathname: string | null,
): "full" | "minimal" | "none" {
  if (pathname === "/staff/login") return "minimal";
  if (pathname === "/staff" || pathname?.startsWith("/staff/")) return "none";
  return "full";
}
