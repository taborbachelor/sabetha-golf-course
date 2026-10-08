import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { menuSections } from "./menu";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0002_phase2_seed.sql"),
  "utf8",
);

describe("0002 seed", () => {
  it("seeds every food item from the menu page at the same price", () => {
    const seeded = new Map(
      [...sql.matchAll(/\('([^']+)',\s*'(\w+)',\s*(\d+),\s*true/g)].map((m) => [
        `${m[2]}|${m[1].replace(/^Kids /, "")}`,
        Number(m[3]),
      ]),
    );
    const expected = menuSections.flatMap((s) =>
      s.items.map((i) => [`${s.name}|${i.name}`, i.priceCents]),
    );

    expect(seeded.size).toBe(expected.length);
    for (const [key, price] of expected) {
      expect(seeded.get(key as string), key as string).toBe(price);
    }
  });
});
