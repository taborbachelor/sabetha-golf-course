/**
 * E2E: Orders queue: phone order -> tablet queue -> Delivered; kitchen toggle; demo switch; staff vs admin.
 *
 *   node e2e/orders-queue.cjs [baseUrl]      (default http://localhost:3000; run from the repo root)
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
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const NAME = "Queue Tester";
const setting = async (key) =>
  (await db.from("settings").select("value").eq("key", key).single()).data
    .value;

async function makeUser(role) {
  const email = `${role}-test-${Date.now()}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role },
  });
  if (error) throw error;
  return { id: data.user.id, email, password };
}

async function signIn(page, user) {
  await page.goto(`${base}/staff`);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page
    .getByRole("heading", { name: "Clubhouse" })
    .waitFor({ timeout: 30000 });
  await page.getByText("Live", { exact: true }).waitFor({ timeout: 30000 });
}

async function orderBeerFromHole5(browser) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await p.goto(`${base}/order?hole=5`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Add Domestic beer (can)" }).click();
  await p.getByRole("button", { name: "Add Bottled water" }).click();
  await p.getByRole("button", { name: /^Checkout/ }).click();
  await p.getByLabel("Name").fill(NAME);
  await p.getByLabel("Phone").fill("785-555-0100");
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
  await p.waitForURL(/\/order\/status\//, { timeout: 90000 });
  await p.getByText("Received").waitFor();
  return p;
}

const waitSetting = async (key, want) => {
  for (let i = 0; i < 60; i++) {
    if ((await setting(key)) === want) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(key + " never became " + want);
};
const current = (p) =>
  p
    .locator("[aria-current=step]")
    .innerText()
    .catch(() => "(none)");

(async () => {
  const admin = await makeUser("admin");
  const staff = await makeUser("staff");
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const errs = [];
  try {
    const tab = await browser.newPage({
      viewport: { width: 1180, height: 820 },
    });
    tab.on("pageerror", (e) => errs.push(e.message));
    await signIn(tab, admin);
    const kitchenBtn = (label) =>
      tab
        .getByRole("group", { name: "Ordering to the course" })
        .getByRole("button", { name: label });
    console.log(
      "1 admin tablet Live; kitchen pressed:",
      await kitchenBtn("Kitchen open").getAttribute("aria-pressed"),
    );

    const demo = tab.getByLabel("Demo: take orders outside hours");
    if (!(await demo.isChecked())) await demo.check();
    await waitSetting("ignore_hours_for_demo", true);
    console.log(
      "2 demo switch via tablet -> DB ignore_hours_for_demo =",
      await setting("ignore_hours_for_demo"),
    );

    const phone = await orderBeerFromHole5(browser);
    const paidAt = Date.now();
    const card = tab
      .locator("section[aria-labelledby=orders-heading] li", { hasText: NAME })
      .first();
    await card.waitFor({ timeout: 30000 });
    console.log(
      `3 order on tablet ${((Date.now() - paidAt) / 1000).toFixed(1)}s after payment (no refresh):`,
      (await card.innerText()).replace(/\n+/g, " | ").slice(0, 140),
    );
    await tab.screenshot({ path: `${shotDir}/queue-new.png` });

    for (const [button, phoneStep] of [
      ["Start", "Preparing"],
      ["Send out", "On the way"],
    ]) {
      await card.getByRole("button", { name: button }).click();
      await phone.waitForFunction(
        (s) =>
          document
            .querySelector("[aria-current=step]")
            ?.textContent?.includes(s),
        phoneStep,
        { timeout: 20000 },
      );
      console.log(
        `4 tablet "${button}" -> phone shows "${(await current(phone)).trim()}"`,
      );
    }
    await tab.screenshot({ path: `${shotDir}/queue-out.png` });
    await card.getByRole("button", { name: "Delivered" }).click();
    await card.waitFor({ state: "detached", timeout: 15000 });
    await phone.waitForFunction(
      () => document.querySelectorAll("ol li span.bg-green-800").length === 4,
      null,
      { timeout: 20000 },
    );
    console.log(
      "5 tablet Delivered -> removed from queue; phone shows all 4 steps done",
    );

    await kitchenBtn("Drinks only").click();
    await waitSetting("kitchen_status", "drinks_only");
    await phone.goto(`${base}/order?hole=5`, { waitUntil: "networkidle" });
    console.log(
      "6 drinks only -> phone menu:",
      (await phone.locator("section h2[id^=cat-]").allInnerTexts()).join(", "),
    );
    await kitchenBtn("Ordering closed").click();
    await waitSetting("kitchen_status", "closed");
    await phone.goto(`${base}/order?hole=5`, { waitUntil: "networkidle" });
    console.log(
      "7 ordering closed -> phone:",
      await phone.locator("p[role=status]").first().innerText(),
    );
    await kitchenBtn("Kitchen open").click();
    await waitSetting("kitchen_status", "open");

    // Plain staff: can flip the kitchen (0004 policy), can't see the demo switch.
    const staffTab = await browser.newPage({
      viewport: { width: 1180, height: 820 },
    });
    await signIn(staffTab, staff);
    console.log(
      "8 staff sees demo switch:",
      await staffTab.getByLabel("Demo: take orders outside hours").count(),
    );
    await staffTab
      .getByRole("group", { name: "Ordering to the course" })
      .getByRole("button", { name: "Drinks only" })
      .click();
    await waitSetting("kitchen_status", "drinks_only");
    console.log(
      "  staff toggled kitchen -> DB kitchen_status =",
      await setting("kitchen_status"),
    );
    await tab.waitForFunction(
      () =>
        document.querySelector(
          "[aria-label='Ordering to the course'] [aria-pressed=true]",
        )?.textContent === "Drinks only",
      null,
      { timeout: 15000 },
    );
    console.log("  admin tablet followed live: Drinks only");
    console.log("page errors:", errs.length ? errs : "none");
  } finally {
    await browser.close();
    await db
      .from("settings")
      .update({ value: false })
      .eq("key", "ignore_hours_for_demo");
    await db
      .from("settings")
      .update({ value: "open" })
      .eq("key", "kitchen_status");
    const { data: gone } = await db
      .from("orders")
      .delete()
      .eq("name", NAME)
      .select("status");
    await db.auth.admin.deleteUser(admin.id);
    await db.auth.admin.deleteUser(staff.id);
    console.log(
      "cleanup: settings reset (demo off, kitchen open); deleted orders:",
      (gone || []).map((o) => o.status).join(", "),
      "; test users deleted",
    );
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
