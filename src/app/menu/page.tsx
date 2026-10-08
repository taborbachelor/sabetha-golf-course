import type { Metadata } from "next";
import { formatPrice, menuSections } from "@/content/menu";
import { getSettings } from "@/content/settings";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Clubhouse menu at Sabetha Golf Club: lunch, fryer, dinner and kids' menu with prices.",
};

export default function MenuPage() {
  const { club } = getSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Clubhouse Menu</h1>
      <p className="mt-3 text-stone-600">
        Prices may change. The kitchen may close for events.
      </p>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {menuSections.map((section) => (
          <section key={section.name} aria-labelledby={`menu-${section.name}`}>
            <h2
              id={`menu-${section.name}`}
              className="border-b-2 border-green-800 pb-1 text-xl font-bold"
            >
              {section.name}
            </h2>
            {section.note && (
              <p className="mt-2 text-sm text-stone-600">{section.note}</p>
            )}
            <ul className="mt-3 space-y-2">
              {section.items.map((item) => (
                <li
                  key={item.name}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span>
                    {item.name}
                    {item.isAlcohol && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                        21+
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatPrice(item.priceCents)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10">
        Daily specials are posted on{" "}
        <a href={club.facebookUrl} className="text-green-800 underline">
          Facebook
        </a>
        .
      </p>
    </div>
  );
}
