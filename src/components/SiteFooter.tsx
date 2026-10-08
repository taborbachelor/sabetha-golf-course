import Link from "next/link";
import { mapsDirectionsUrl, telHref } from "@/lib/contact";
import { moreLinks, navItems } from "@/lib/nav";
import type { Settings } from "@/content/settings";

export function SiteFooter({ club }: { club: Settings["club"] }) {
  return (
    <footer className="mt-auto border-t border-black/10 bg-stone-100 print:hidden">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <p className="font-semibold">{club.name}</p>
          <address className="not-italic">
            {club.streetAddress}, {club.city}, {club.state} {club.postalCode}
            <br />
            {club.locationNote}
          </address>
          <p className="flex flex-wrap gap-x-4 gap-y-2">
            <a
              href={mapsDirectionsUrl(club)}
              className="font-medium text-green-800 underline"
            >
              Directions
            </a>
            <a
              href={telHref(club.phone)}
              className="font-medium text-green-800 underline"
            >
              Call {club.phone}
            </a>
          </p>
        </div>
        <nav aria-label="Footer" className="min-w-0">
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-x-4 gap-y-2">
            {[...navItems, ...moreLinks].map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`hover:underline ${item.primary ? "font-semibold text-green-800" : ""}`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
