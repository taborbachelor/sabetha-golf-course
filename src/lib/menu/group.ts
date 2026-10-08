import type { MenuRow } from "@/lib/orders/order";

export type MenuGroup = { category: string; items: MenuRow[] };

/**
 * Items grouped by section, in menu order: sections appear in the order of
 * their first item, items by sort_order then name.
 */
export function groupMenu(rows: MenuRow[]): MenuGroup[] {
  const sorted = [...rows].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
  );
  const groups = new Map<string, MenuRow[]>();
  for (const row of sorted) {
    const list = groups.get(row.category) ?? [];
    list.push(row);
    groups.set(row.category, list);
  }
  return [...groups].map(([category, items]) => ({ category, items }));
}
