import type { Metadata } from "next";
import { Suspense } from "react";
import { formatPrice } from "@/content/menu";
import { requireAdmin } from "@/lib/auth";
import { MENU_COLUMNS } from "@/lib/menu";
import { groupMenu } from "@/lib/menu/group";
import type { MenuRow } from "@/lib/orders/order";
import { createServerSupabase } from "@/lib/supabase/server";
import { MenuItemForm } from "./MenuItemForm";

export const metadata: Metadata = {
  title: "Admin: Menu",
  robots: { index: false, follow: false },
};

export default function AdminMenuPage() {
  return (
    <Suspense fallback={<p className="text-stone-600">Loading…</p>}>
      <MenuAdmin />
    </Suspense>
  );
}

async function MenuAdmin() {
  await requireAdmin("/admin/menu");
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("menu_items")
    .select(MENU_COLUMNS)
    .returns<MenuRow[]>();
  if (error) throw error;

  const groups = groupMenu(data);
  const categories = groups.map((g) => g.category);
  const nextSortOrder =
    data.reduce((max, item) => Math.max(max, item.sort_order), 0) + 1;

  return (
    <div className="space-y-8">
      <p className="text-sm text-stone-600">
        Changes show on the Menu page and in Order to the Course right away.
        Untick <span className="font-medium">On the menu</span> to hide an item
        for now (sold out, seasonal). <span className="font-medium">Drink</span>{" "}
        items can still be ordered when the kitchen is set to Drinks only. The
        small grey number is each item&apos;s order: lower numbers show first.
      </p>

      <details className="rounded-lg border border-green-800 bg-white p-4">
        <summary className="cursor-pointer font-semibold text-green-800">
          Add an item
        </summary>
        <div className="mt-4">
          <MenuItemForm categories={categories} nextSortOrder={nextSortOrder} />
        </div>
      </details>

      {groups.map((group) => (
        <section key={group.category} aria-label={group.category}>
          <h2 className="text-lg font-bold">{group.category}</h2>
          <ul className="mt-2 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
            {group.items.map((item) => (
              <li key={item.id}>
                <details className="group px-4 py-3">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2">
                    <span
                      className={`font-medium ${item.available ? "" : "text-stone-400 line-through"}`}
                    >
                      {item.name}
                    </span>
                    {item.is_alcohol && <Badge>21+</Badge>}
                    <Badge>{item.is_food ? "Food" : "Drink"}</Badge>
                    {item.is_sample && <Badge>Sample</Badge>}
                    {!item.available && <Badge>Hidden</Badge>}
                    <span className="ml-auto flex items-baseline gap-3">
                      <span
                        className="text-xs text-stone-400 tabular-nums"
                        title="Order on menu"
                      >
                        #{item.sort_order}
                      </span>
                      <span className="tabular-nums">
                        {formatPrice(item.price_cents)}
                      </span>
                    </span>
                  </summary>
                  <div className="mt-4">
                    <MenuItemForm item={item} categories={categories} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
      {children}
    </span>
  );
}
