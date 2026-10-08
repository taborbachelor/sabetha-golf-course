export type NavItem = { href: string; label: string };

/** Main site navigation. Every href must have a page under src/app. */
export const navItems: NavItem[] = [
  { href: "/golf", label: "Golf" },
  { href: "/memberships", label: "Memberships" },
  { href: "/menu", label: "Menu" },
  { href: "/pool", label: "Pool" },
  { href: "/events", label: "Events" },
  { href: "/clubhouse-rental", label: "Clubhouse Rental" },
  { href: "/gift-cards", label: "Gift Cards" },
  { href: "/contact", label: "Contact" },
];
