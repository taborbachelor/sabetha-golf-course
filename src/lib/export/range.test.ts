import { describe, expect, it } from "vitest";
import { defaultExportRange, parseExportRange } from "./range";

describe("defaultExportRange", () => {
  it("is this month so far after the first week", () => {
    expect(defaultExportRange("2026-10-08")).toEqual({
      from: "2026-10-01",
      to: "2026-10-08",
    });
    expect(defaultExportRange("2026-10-31")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("is all of last month in the first 7 days", () => {
    expect(defaultExportRange("2026-10-01")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(defaultExportRange("2026-10-07")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(defaultExportRange("2027-01-03")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
    expect(defaultExportRange("2028-03-05")).toEqual({
      from: "2028-02-01",
      to: "2028-02-29",
    });
  });
});

describe("parseExportRange", () => {
  it("uses the default range for missing dates", () => {
    expect(parseExportRange(null, "", "2026-10-20")).toEqual({
      ok: true,
      range: { from: "2026-10-01", to: "2026-10-20" },
    });
  });

  it("explains backwards or broken dates", () => {
    expect(parseExportRange("2026-10-09", "2026-10-01", "2026-10-20")).toEqual({
      ok: false,
      message:
        "The To date is before the From date. Pick a To date on or after From.",
    });
    expect(
      parseExportRange("2026-02-30", "2026-03-01", "2026-10-20"),
    ).toMatchObject({
      ok: false,
    });
    expect(
      parseExportRange("2026-10-05", "2026-10-05", "2026-10-20"),
    ).toMatchObject({
      ok: true,
    });
  });
});
