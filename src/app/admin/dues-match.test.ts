import { describe, expect, it } from "vitest";
import { duesByEmail, emailKey } from "./dues-match";

describe("duesByEmail", () => {
  const pay = (id: string, email: string) => ({ id, email });

  it("matches emails regardless of case and spaces", () => {
    const byEmail = duesByEmail([
      pay("a", "Pat@Example.com"),
      pay("b", "other@example.com"),
      pay("c", " pat@example.COM "),
    ]);
    expect(byEmail.get(emailKey("PAT@example.com"))?.map((p) => p.id)).toEqual([
      "a",
      "c",
    ]);
    expect(byEmail.get(emailKey("other@example.com"))).toHaveLength(1);
    expect(byEmail.get(emailKey("nobody@example.com"))).toBeUndefined();
  });
});
