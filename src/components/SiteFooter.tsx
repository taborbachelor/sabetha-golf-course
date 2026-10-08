import Link from "next/link";
import { navItems } from "@/lib/nav";
import type { Settings } from "@/content/settings";

export function SiteFooter({ club }: { club: Settings["club"] }) {
  return (
    <footer className="mt-auto border-t border-black/10 bg-stone-100 print:hidden">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-2">
        <div>
          <p className="font-semibold">{club.name}</p>
          <p>{club.locationNote}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="hover:underline">
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
