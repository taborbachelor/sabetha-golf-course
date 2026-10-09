import { describe, expect, it } from "vitest";
import { parseRememberedContact } from "./contact";

describe("parseRememberedContact", () => {
  it("reads a stored name and phone", () => {
    expect(
      parseRememberedContact('{"name":" Pat ","phone":"785-555-0100"}'),
    ).toEqual({ name: "Pat", phone: "785-555-0100" });
  });

  it("keeps whichever field is present", () => {
    expect(parseRememberedContact('{"name":"Pat"}')).toEqual({
      name: "Pat",
      phone: "",
    });
  });

  it("treats missing, garbled or wrong-shaped data as nothing remembered", () => {
    for (const raw of [
      null,
      undefined,
      "",
      "not json",
      "null",
      "42",
      '"Pat"',
      "[]",
      '{"name":5,"phone":true}',
      '{"name":"  ","phone":""}',
    ]) {
      expect(parseRememberedContact(raw)).toBeNull();
    }
  });

  it("caps overly long values", () => {
    const r = parseRememberedContact(
      JSON.stringify({ name: "x".repeat(500), phone: "1".repeat(500) }),
    );
    expect(r?.name).toHaveLength(80);
    expect(r?.phone).toHaveLength(30);
  });
});
