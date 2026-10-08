import type { Metadata } from "next";
import { formatPrice, menuSections } from "@/content/menu";
import { getPublicMenu } from "@/lib/menu";
import { groupMenu, type MenuGroup } from "@/lib/menu/group";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Menu",
  description:
    "Clubhouse menu at Sabetha Golf Club: lunch, fryer, dinner and kids' menu with prices.",
};

export default async function MenuPage() {
  const { club } = await getSettings();
  const menu = await getPublicMenu();
  const groups = menu ? groupMenu(menu) : printedMenu();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Clubhouse Menu</h1>
      <p className="mt-3 text-stone-600">
        Prices may change. The kitchen may close for events.
      </p>

      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {groups.map(({ category, items }) => {
          const note = menuSections.find((s) => s.name === category)?.note;
          const id = `menu-${category.replace(/\W+/g, "-")}`;
          return (
            <section key={category} aria-labelledby={id}>
              <h2
                id={id}
                className="border-b-2 border-green-800 pb-1 text-xl font-bold"
              >
                {category}
              </h2>
              {note && <p className="mt-2 text-sm text-stone-600">{note}</p>}
              <ul className="mt-3 space-y-2">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span>
                      {item.name}
                      {item.is_alcohol && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">
                          21+
                        </span>
                      )}
                      {item.is_sample && (
                        <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                          Sample
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatPrice(item.price_cents)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
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

/** The transcribed printed menu, for when the database can't be reached. */
function printedMenu(): MenuGroup[] {
  return menuSections.map((section) => ({
    category: section.name,
    items: section.items.map((item, i) => ({
      id: `${section.name}-${i}`,
      name: item.name,
      category: section.name,
      price_cents: item.priceCents,
      is_food: true,
      is_alcohol: !!item.isAlcohol,
      available: true,
      is_sample: false,
      sort_order: i,
    })),
  }));
}
