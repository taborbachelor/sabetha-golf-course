import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { chromeFor, isCurrent, moreLinks, navItems } from "./nav";

describe("navItems", () => {
  it("leads with Pay to Play", () => {
    expect(navItems[0]).toMatchObject({ href: "/pay", primary: true });
  });

  it("only links to pages that exist", () => {
    for (const { href } of [...navItems, ...moreLinks]) {
      expect(
        existsSync(join(process.cwd(), "src/app", href, "page.tsx")),
        href,
      ).toBe(true);
    }
  });
});

describe("isCurrent", () => {
  it("matches the page and pages below it", () => {
    expect(isCurrent("/memberships", "/memberships")).toBe(true);
    expect(isCurrent("/memberships", "/memberships/apply")).toBe(true);
    expect(isCurrent("/pay", "/pay/receipt/abc")).toBe(true);
  });

  it("doesn't match look-alike paths or the home page", () => {
    expect(isCurrent("/pay", "/payments")).toBe(false);
    expect(isCurrent("/golf", "/")).toBe(false);
    expect(isCurrent("/", "/golf")).toBe(false);
    expect(isCurrent("/golf", null)).toBe(false);
  });
});

describe("chromeFor", () => {
  it("hides the site header and footer on the staff board", () => {
    expect(chromeFor("/staff")).toBe("none");
  });

  it("keeps a minimal header on staff sign-in", () => {
    expect(chromeFor("/staff/login")).toBe("minimal");
  });

  it("keeps the full site everywhere else, admin included", () => {
    expect(chromeFor("/")).toBe("full");
    expect(chromeFor("/admin")).toBe("full");
    expect(chromeFor("/staffing")).toBe("full");
    expect(chromeFor(null)).toBe("full");
  });
});
