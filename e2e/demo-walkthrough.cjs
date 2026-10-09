/**
 * E2E: The Phase 2 demo, end to end, the way it will be shown at the pitch:
 *   phone pays for a round with a cart -> it appears on the tablet without refreshing -> staff assign a cart and
 *   tap Ready -> phone orders a drink from hole 5 -> tablet walks it New -> Preparing -> Out for delivery ->
 *   Delivered while the phone's status page follows live.
 * Also sweeps every public page on a phone and the staff screens on a tablet for sideways scrolling and
 * page errors.
 *
 *   node e2e/demo-walkthrough.cjs [baseUrl] [--docs]
 *
 * --docs saves the step screenshots to docs/demo/ (used by docs/DEMO.md); otherwise e2e/.shots.
 * Drives the installed Microsoft Edge with playwright-core. Uses the DEMO database from .env.local:
 * creates a temporary admin user and rows, deletes them afterwards, and puts ignore_hours_for_demo and
 * kitchen_status back. Square sandbox only: no real money moves.
 * Don't pipe this into `head`: that kills it before the cleanup runs.
 */
const { chromium, devices } = require("playwright-core");
const fs = require("fs");
const { randomBytes } = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const args = process.argv.slice(2);
const base = args.find((a) => !a.startsWith("--")) || "http://localhost:3000";
const shotDir = args.includes("--docs") ? "docs/demo" : "e2e/.shots/demo";
fs.mkdirSync(shotDir, { recursive: true });
const env = {};
for (const l of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const GOLFER = "Sam Sample";
// iPhone-sized, at 2x so screenshots stay a sensible size.
const PHONE = {
  ...devices["iPhone 13"],
  deviceScaleFactor: 2,
  defaultBrowserType: undefined,
};
const TABLET = { viewport: { width: 1180, height: 820 }, hasTouch: true }; // iPad landscape

const t0 = Date.now();
const log = (step, ...rest) =>
  console.log(
    `[${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}s] ${step}`,
    ...rest,
  );
// Docs screenshots are JPEGs so the repo stays small.
const docs = args.includes("--docs");
const shot = (page, name, fullPage = false) =>
  page.screenshot({
    path: `${shotDir}/${name}.${docs ? "jpg" : "png"}`,
    fullPage,
    ...(docs ? { type: "jpeg", quality: 70 } : {}),
  });

async function payWithCard(p) {
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
}

/**
 * Open a page and let it finish laying out. Not "networkidle": the
 * production build keeps background prefetches open, so the network never
 * goes quiet there.
 */
async function settle(page, url) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(1500);
}

/** Pages that scroll sideways on this screen (a classic phone-layout bug). */
async function overflow(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
}

(async () => {
  // A tidy name for the pitch screenshots; clear out any leftover from a killed run.
  const email = "clubhouse@example.com";
  const { data: existing } = await db.auth.admin.listUsers({ perPage: 1000 });
  const stale = existing?.users.find((u) => u.email === email);
  if (stale) await db.auth.admin.deleteUser(stale.id);
  const password = randomBytes(18).toString("base64url");
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin" },
  });
  if (error) throw error;
  const { data: savedSettings } = await db
    .from("settings")
    .select("key, value, updated_at")
    .in("key", ["ignore_hours_for_demo", "kitchen_status"]);

  const b = await chromium.launch({ channel: "msedge", headless: true });
  const errors = [];
  const problems = [];
  try {
    const phoneCtx = await b.newContext(PHONE);
    const tabletCtx = await b.newContext(TABLET);
    const phone = await phoneCtx.newPage();
    const tablet = await tabletCtx.newPage();
    for (const [name, p] of [
      ["phone", phone],
      ["tablet", tablet],
    ]) {
      p.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
    }

    // 0. Tablet: staff sign in; the board goes Live.
    await tablet.goto(`${base}/staff`);
    await tablet.getByLabel("Email").fill(email);
    await tablet.getByLabel("Password").fill(password);
    await tablet.getByRole("button", { name: "Sign in" }).click();
    await tablet
      .getByRole("heading", { name: "Clubhouse" })
      .waitFor({ timeout: 90000 });
    await tablet.getByText("Live", { exact: true }).waitFor({ timeout: 30000 });
    log(
      "0 tablet signed in, board Live;",
      await tablet.locator("#carts-heading span").innerText(),
    );
    await shot(tablet, "00-tablet-board");

    // 1. Phone: home page -> Pay to Play.
    await phone.goto(`${base}/`);
    await shot(phone, "01-phone-home");
    await phone
      .getByRole("link", { name: /Pay to Play/ })
      .first()
      .click();
    await phone.waitForURL(/\/pay$/);
    await phone.getByRole("button", { name: "More players" }).click();
    await phone.getByRole("button", { name: "More carts" }).click();
    await phone.getByRole("button", { name: "Now", exact: true }).click();
    await phone.getByLabel("Name").fill(GOLFER);
    await phone.getByLabel("Phone").fill("785-555-0100");
    await phone.getByLabel("Email").fill("sam@example.com");
    await phone.waitForFunction(
      () =>
        /available/i.test(
          document.querySelector("p[role=status]")?.textContent || "",
        ),
      null,
      { timeout: 30000 },
    );
    const total = (await phone.getByLabel("Total").innerText()).replace(
      /\s+/g,
      " ",
    );
    log("1 phone Pay to Play: 2 players, 1 cart, now |", total);
    await shot(phone, "02-phone-pay-form", true);
    await phone.getByRole("button", { name: "Continue to payment" }).click();
    await payWithCard(phone);
    await phone.waitForURL(/\/pay\/receipt\//, { timeout: 90000 });
    const paidAt = Date.now();
    await phone.getByText("You're all set").waitFor({ timeout: 30000 });
    const code = (await phone.locator("main h1:visible").innerText()).trim();
    log("2 phone paid; receipt", code);
    await shot(phone, "03-phone-receipt", true);

    // 2. Tablet: appears without a refresh.
    const paidRow = tablet.locator("section[aria-labelledby=paid-heading] li", {
      hasText: GOLFER,
    });
    await paidRow.waitFor({ timeout: 30000 });
    log(
      `3 tablet shows the round ${((Date.now() - paidAt) / 1000).toFixed(1)}s after payment (no refresh)`,
    );
    await shot(tablet, "04-tablet-paid-today");

    // 3. Tablet: assign a cart, Ready.
    const needs = tablet.locator("section[aria-labelledby=needs-heading] li", {
      hasText: GOLFER,
    });
    await needs.getByRole("button", { name: "Assign" }).click();
    const tile = tablet.locator("section[aria-labelledby=carts-heading] li", {
      hasText: GOLFER,
    });
    await tile
      .getByText("Reserved", { exact: true })
      .waitFor({ timeout: 15000 });
    const cartNo = (await tile.locator("span.text-3xl").innerText()).trim();
    await tile.getByRole("button", { name: "Ready", exact: true }).click();
    await tile.getByText("Ready", { exact: true }).waitFor({ timeout: 15000 });
    log(`4 tablet assigned cart ${cartNo} and tapped Ready`);
    await shot(tablet, "05-tablet-cart-ready");

    // 4. Demo switch so ordering works outside clubhouse hours (admin only).
    const demo = tablet.getByLabel("Demo: take orders outside hours");
    if (!(await demo.isChecked())) await demo.check();
    const kitchenOpen = tablet
      .getByRole("group", { name: "Ordering to the course" })
      .getByRole("button", { name: "Kitchen open" });
    if ((await kitchenOpen.getAttribute("aria-pressed")) !== "true")
      await kitchenOpen.click();
    for (let i = 0; i < 40; i++) {
      const { data } = await db
        .from("settings")
        .select("value")
        .eq("key", "ignore_hours_for_demo")
        .single();
      if (data.value === true) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    log("5 tablet: demo switch on, kitchen open");

    // 5. Phone: order a drink from hole 5 (the tee-box QR link).
    await phone.goto(`${base}/order?hole=5`);
    await phone
      .getByRole("button", { name: "Add Domestic beer (can)" })
      .click();
    await phone.getByRole("button", { name: "Add Bottled water" }).click();
    await shot(phone, "06-phone-order-menu");
    await phone.getByRole("button", { name: /^Checkout/ }).click();
    await phone.getByLabel("Name").fill(GOLFER);
    await phone.getByLabel("Phone").fill("785-555-0100");
    await payWithCard(phone);
    await phone.waitForURL(/\/order\/status\//, { timeout: 90000 });
    await phone.getByText("Received").waitFor();
    const orderedAt = Date.now();
    log(
      "6 phone ordered from hole 5:",
      (await phone.locator("main h1:visible").innerText()).trim(),
    );
    await shot(phone, "07-phone-order-received", true);

    // 6. Tablet: New -> Preparing -> Out for delivery -> Delivered; phone follows.
    const order = tablet
      .locator("section[aria-labelledby=orders-heading] li", {
        hasText: GOLFER,
      })
      .first();
    await order.waitFor({ timeout: 30000 });
    log(
      `7 tablet shows the order ${((Date.now() - orderedAt) / 1000).toFixed(1)}s after payment:`,
      (await order.innerText()).replace(/\n+/g, " | ").slice(0, 110),
    );
    await shot(tablet, "08-tablet-order-new");
    for (const [button, step, file] of [
      ["Start", "Preparing", null],
      ["Send out", "On the way", "09-phone-on-the-way"],
    ]) {
      const at = Date.now();
      await order.getByRole("button", { name: button }).click();
      await phone.waitForFunction(
        (s) =>
          document
            .querySelector("[aria-current=step]")
            ?.textContent?.includes(s),
        step,
        { timeout: 20000 },
      );
      log(
        `8 tablet "${button}" -> phone "${step}" in ${((Date.now() - at) / 1000).toFixed(1)}s`,
      );
      if (file) await shot(phone, file, true);
    }
    await order.getByRole("button", { name: "Delivered" }).click();
    await order.waitFor({ state: "detached", timeout: 15000 });
    await phone.waitForFunction(
      () => document.querySelectorAll("ol li span.bg-green-800").length === 4,
      null,
      { timeout: 20000 },
    );
    log("9 tablet Delivered -> order leaves the queue; phone shows Delivered");
    await shot(phone, "10-phone-delivered", true);
    await shot(tablet, "11-tablet-after");

    // 7. Layout sweep: no sideways scrolling, no page errors.
    const publicPages = [
      "/",
      "/golf",
      "/memberships",
      "/memberships/apply",
      "/memberships/dues",
      "/menu",
      "/pool",
      "/events",
      "/clubhouse-rental",
      "/contact",
      "/gift-cards",
      "/pay",
      "/order?hole=5",
    ];
    for (const path of publicPages) {
      await settle(phone, `${base}${path}`);
      const extra = await overflow(phone);
      if (extra > 0)
        problems.push(`phone ${path}: scrolls sideways by ${extra}px`);
    }
    const staffPages = [
      "/staff",
      "/admin",
      "/admin/settings",
      "/admin/menu",
      "/admin/tiers",
      "/admin/carts",
      "/admin/export",
      "/admin/signs",
    ];
    for (const size of [
      { width: 1180, height: 820 },
      { width: 820, height: 1180 },
    ]) {
      await tablet.setViewportSize(size);
      for (const path of staffPages) {
        await settle(tablet, `${base}${path}`);
        const extra = await overflow(tablet);
        if (extra > 0)
          problems.push(
            `tablet ${size.width}w ${path}: scrolls sideways by ${extra}px`,
          );
      }
    }
    await tablet.goto(`${base}/staff`);
    await tablet.getByText("Live", { exact: true }).waitFor({ timeout: 30000 });
    await shot(tablet, "12-tablet-portrait");
    log(
      `10 layout sweep: ${publicPages.length} phone pages, ${staffPages.length * 2} tablet views`,
    );
    console.log("problems:", problems.length ? problems : "none");
    console.log("page errors:", errors.length ? errors : "none");
  } catch (e) {
    for (const [i, pg] of b
      .contexts()
      .flatMap((c) => c.pages())
      .entries())
      await pg.screenshot({ path: `${shotDir}/fail-${i}.png` }).catch(() => {});
    throw e;
  } finally {
    await b.close();
    const { data: orders } = await db
      .from("orders")
      .delete()
      .eq("name", GOLFER)
      .select("id");
    const { data: rounds } = await db
      .from("rounds")
      .select("id")
      .eq("name", GOLFER);
    const roundIds = (rounds ?? []).map((r) => r.id);
    if (roundIds.length)
      await db.from("cart_sessions").delete().in("round_id", roundIds);
    await db.from("rounds").delete().eq("name", GOLFER);
    for (const row of savedSettings)
      await db
        .from("settings")
        .update({ value: row.value, updated_at: row.updated_at })
        .eq("key", row.key);
    await db.auth.admin.deleteUser(created.user.id);
    console.log(
      `cleanup: deleted ${roundIds.length} round(s), ${orders?.length ?? 0} order(s), the demo user; settings restored`,
    );
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
