/**
 * Clubhouse menu, transcribed from the menu image on
 * sabethagolfclub.com/menu as of 2026-10-07. Seed data for the
 * `menu_items` table (Phase 2). Prices in cents.
 *
 * The printed menu repeats the Fryer items under Dinner as "Appetizers" and
 * "Sides" at the same prices; they are listed once here.
 */

export type MenuItem = {
  name: string;
  priceCents: number;
  isAlcohol?: boolean;
};

export type MenuSection = {
  name: string;
  note?: string;
  items: MenuItem[];
};

export const menuSections: MenuSection[] = [
  {
    name: "Lunch",
    note: "The afternoon menu continues into the evening.",
    items: [
      { name: "Chicken Strips, 2 piece", priceCents: 575 },
      { name: "Chicken Strips, 4 piece", priceCents: 1050 },
      { name: "Hot Dog", priceCents: 200 },
      { name: "Ham and Cheddar Slider", priceCents: 650 },
      { name: "Fantail Shrimp, 3 piece", priceCents: 625 },
      { name: "Fantail Shrimp, 6 piece", priceCents: 1125 },
    ],
  },
  {
    name: "Fryer",
    note: "Appetizers and sides, served at lunch and dinner.",
    items: [
      { name: "Fried Pickles", priceCents: 750 },
      { name: "Mushrooms", priceCents: 825 },
      { name: "Mozzarella Sticks", priceCents: 825 },
      { name: "Bottle Neck Beer Fries", priceCents: 700 },
      { name: "Onion Straws", priceCents: 700 },
      { name: "Cheeseballs", priceCents: 825 },
      { name: "Pepper Jack Cheeseballs", priceCents: 825 },
    ],
  },
  {
    name: "Dinner",
    items: [
      { name: "Cheeseburger", priceCents: 995 },
      { name: "Fried Chicken Sandwich", priceCents: 1050 },
      { name: "Tenderloin Sandwich", priceCents: 995 },
    ],
  },
  {
    name: "Kids",
    items: [
      { name: "Cheeseburger", priceCents: 800 },
      { name: "Mini Corn Dogs", priceCents: 575 },
      { name: "Grilled Cheese", priceCents: 525 },
    ],
  },
];

export function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
