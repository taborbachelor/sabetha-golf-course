/**
 * E2E: Staff tablet: phone pays with a cart -> appears live -> assign / ready / out / returned; walk-in rental.
 *
 *   node e2e/staff-board.cjs [baseUrl]      (default http://localhost:3000; run from the repo root)
 *
 * Drives the installed Microsoft Edge with playwright-core. Uses the DEMO
 * database from .env.local: creates temporary users/rows and deletes them
 * afterwards, and resets kitchen_status / ignore_hours_for_demo. Square sandbox only.
 * Screenshots go to e2e/.shots (gitignored).
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const { randomBytes } = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const base = process.argv[2] || "http://localhost:3000";
const envFile = ".env.local";
const shotDir = "e2e/.shots";
require("fs").mkdirSync(shotDir, { recursive: true });
const env = {};
for (const l of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const email = `board-test-${Date.now()}@example.com`,
  password = randomBytes(18).toString("base64url");
const GOLFER = "Realtime Tester";

async function payOnPhone(browser) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(`${base}/pay`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "More players" }).click();
  await p.getByRole("button", { name: "More carts" }).click();
  await p.getByRole("button", { name: "Now", exact: true }).click(); // "Now" works at any hour (not after midnight)
  await p.getByLabel("Name").fill(GOLFER);
  await p.getByLabel("Phone").fill("785-555-0100");
  await p.getByLabel("Email").fill("rt@example.com");
  await p.waitForFunction(
    () =>
      /available/i.test(
        document.querySelector("p[role=status]")?.textContent || "",
      ),
    null,
    { timeout: 20000 },
  );
  await p.getByRole("button", { name: "Continue to payment" }).click();
  await p
    .locator("iframe.sq-card-component")
    .scrollIntoViewIfNeeded({ timeout: 30000 });
  const f = p.frameLocator("iframe.sq-card-component");
  await f.locator("#cardNumber").waitFor({ timeout: 60000 });
  await f.locator("#cardNumber").fill("4111 1111 1111 1111");
  await f.locator("#expirationDate").fill("12/30");
  await f.locator("#cvv").fill("111");
  if (await f.locator("#postalCode").count())
    await f.locator("#postalCode").fill("66534");
  await p.getByRole("button", { name: /^Pay \$/ }).click();
  await p.waitForURL(/\/pay\/receipt\//, { timeout: 90000 });
  const code = (await p.locator("main h1").innerText()).trim();
  await p.close();
  return code;
}

(async () => {
  const { data: u, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "staff" },
  });
  if (error) throw error;
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const errs = [];
  try {
    const tab = await browser.newPage({
      viewport: { width: 1180, height: 820 },
    });
    tab.on("pageerror", (e) => errs.push(e.message));
    await tab.goto(`${base}/staff`);
    await tab.getByLabel("Email").fill(email);
    await tab.getByLabel("Password").fill(password);
    await tab.getByRole("button", { name: "Sign in" }).click();
    await tab
      .getByRole("heading", { name: "Clubhouse" })
      .waitFor({ timeout: 30000 });
    await tab.getByText("Live", { exact: true }).waitFor({ timeout: 30000 });
    console.log("1 tablet signed in, realtime: Live");
    console.log(
      "  carts available:",
      await tab.locator("#carts-heading span").innerText(),
    );

    const code = await payOnPhone(browser);
    const paidAt = Date.now();
    await tab
      .locator("section[aria-labelledby=paid-heading] li", { hasText: GOLFER })
      .waitFor({ timeout: 30000 });
    console.log(
      `2 phone paid ${code}; appeared on tablet ${((Date.now() - paidAt) / 1000).toFixed(1)}s after receipt (no refresh)`,
    );
    const needs = tab.locator("section[aria-labelledby=needs-heading] li", {
      hasText: GOLFER,
    });
    await needs.waitFor({ timeout: 15000 });
    console.log(
      "3 needs a cart:",
      (await needs.innerText()).replace(/\n/g, " | ").slice(0, 80),
    );
    await tab.screenshot({ path: `${shotDir}/board-1-new.png` });

    await needs.getByRole("button", { name: "Assign" }).click();
    const tile = tab.locator("section[aria-labelledby=carts-heading] li", {
      hasText: GOLFER,
    });
    await tile
      .getByText("Reserved", { exact: true })
      .waitFor({ timeout: 15000 });
    const num = (await tile.locator("span.text-3xl").innerText()).trim();
    console.log(`4 assigned cart ${num}: Reserved`);
    for (const [btn, label] of [
      ["Ready", "Ready"],
      ["Out", "Out"],
    ]) {
      await tile.getByRole("button", { name: btn, exact: true }).click();
      await tile.getByText(label, { exact: true }).waitFor({ timeout: 15000 });
      console.log(`5 tapped ${btn} -> ${label}`);
    }
    await tab.screenshot({ path: `${shotDir}/board-2-out.png` });
    await tile.getByRole("button", { name: "Returned" }).click();
    await tab
      .locator("section[aria-labelledby=carts-heading] li", { hasText: num })
      .first()
      .getByText("Available", { exact: true })
      .waitFor({ timeout: 15000 });
    console.log("6 tapped Returned -> cart", num, "Available");

    await tab.getByRole("button", { name: "Rent cart (walk-in)" }).click();
    const form = tab.getByRole("form", { name: "Rent a cart to a walk-in" });
    await form.getByLabel("Name").fill("Walk-in Tester");
    await form.getByRole("button", { name: "18", exact: true }).click();
    await form.getByRole("button", { name: "Cart is out" }).click();
    const walk = tab.locator("section[aria-labelledby=carts-heading] li", {
      hasText: "Walk-in Tester",
    });
    await walk.getByText("Out", { exact: true }).waitFor({ timeout: 15000 });
    console.log(
      "7 walk-in:",
      (await walk.innerText()).replace(/\n/g, " | ").slice(0, 90),
    );
    await tab.screenshot({ path: `${shotDir}/board-3-walkin.png` });
    await walk.getByRole("button", { name: "Returned" }).click();
    await walk.waitFor({ state: "detached", timeout: 15000 });
    console.log(
      "8 walk-in returned; carts:",
      await tab.locator("#carts-heading span").innerText(),
    );
    console.log("page errors:", errs.length ? errs : "none");
  } finally {
    await browser.close();
    await admin
      .from("cart_sessions")
      .delete()
      .in("name", [GOLFER, "Walk-in Tester"]);
    await admin.from("rounds").delete().eq("name", GOLFER);
    await admin.auth.admin.deleteUser(u.user.id);
    console.log("cleanup: test user, rounds and cart sessions deleted");
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
