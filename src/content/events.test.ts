import { describe, expect, it } from "vitest";
import { isIsoDate } from "@/lib/dates";
import { tournamentYear, tournaments } from "./events";

describe("tournaments", () => {
  it("each lastDay is a real date matching the shown date", () => {
    for (const t of tournaments) {
      expect(isIsoDate(t.lastDay), t.name).toBe(true);
      const d = new Date(`${t.lastDay}T12:00:00Z`);
      expect(d.getUTCFullYear()).toBe(tournamentYear);
      expect(
        d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" }),
      ).toBe(t.month);
      const lastShownDay = Number(t.date.match(/\d+/g)!.at(-1));
      expect(d.getUTCDate(), t.name).toBe(lastShownDay);
    }
  });
});
