import { describe, expect, it } from "vitest";
import { csvField, dollars, toCsv } from "./csv";

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvField("Smith, Pat")).toBe('"Smith, Pat"');
    expect(csvField('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvField("1 Main St\nSabetha")).toBe('"1 Main St\nSabetha"');
    expect(csvField("plain")).toBe("plain");
  });

  it("stops spreadsheet formulas in text", () => {
    expect(csvField("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvField("+1 785")).toBe("'+1 785");
    expect(csvField("@sum")).toBe("'@sum");
    // Numbers are numbers, not text.
    expect(csvField(-5)).toBe("-5");
  });

  it("writes empty cells for missing values", () => {
    expect(csvField(null)).toBe("");
    expect(csvField(undefined)).toBe("");
    expect(csvField(false)).toBe("false");
  });

  it("builds a CRLF file with a header", () => {
    expect(toCsv(["a", "b"], [[1, "x,y"]])).toBe('a,b\r\n1,"x,y"\r\n');
  });

  it("formats cents as dollars", () => {
    expect(dollars(1050)).toBe("10.50");
    expect(dollars(0)).toBe("0.00");
    expect(dollars(null)).toBe("");
  });
});
