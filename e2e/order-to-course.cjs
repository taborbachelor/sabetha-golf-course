/**
 * E2E: Order to the Course, on an iPhone-sized screen:
 *  closed messages (hours / kitchen) with tap-to-call; slow-network "+" taps;
 *  validation focus; order to hole 5; status page (phone link, live steps,
 *  "Checking…" offline, cancelled wording); "Order something else" -> fresh
 *  menu with no hole picked and name/phone remembered; Back never lands on a
 *  frozen form; bottom bar returns when checkout is off screen; an item that
 *  becomes unavailable is named and removable; drinks only; decline.
 *
 *   node e2e/order-to-course.cjs [baseUrl]      (default http://localhost:3000; run from the repo root)
 *
 * Drives the installed Microsoft Edge with playwright-core. Uses the DEMO
 * database from .env.local: records kitchen_status / ignore_hours_for_demo
 * (value AND updated_at) first and puts both back exactly at the end, and
 * deletes the orders it creates. Square sandbox only.
 * Screenshots go to e2e/.shots (gitignored).
 */
const { chromium, devices } = require("playwright-core");
const fs = require("fs");
const { createClient } = require("@supabase/supabase-js");
const base = process.argv[2] || "http://localhost:3000";
const envFile = ".env.local";
const shotDir = "e2e/.shots";
fs.mkdirSync(shotDir, { recursive: true });
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
const KEYS = ["kitchen_status", "ignore_hours_for_demo"];
// updated_at matters: a kitchen status set on an earlier day is ignored.
const setting = (key, value) =>
  db
    .from("settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", key);
const NAME = `Order QA ${Date.now().toString(36)}`;
const PHONE = "785-555-0100";

function check(label, ok, detail = "") {
  console.log(
    `  ${ok ? "ok  " : "FAIL"} ${label}${detail ? `: ${detail}` : ""}`,
  );
  if (!ok) process.exitCode = 1;
}

async function fillCard(p, card) {
  await p
    .locator("iframe.sq-card-component")
    .scrollIntoViewIfNeeded({ timeout: 30000 });
  const f = p.frameLocator("iframe.sq-card-component");
  await f.locator("#cardNumber").waitFor({ timeout: 60000 });
  await f.locator("#cardNumber").fill(card);
  await f.locator("#expirationDate").fill("12/30");
  await f.locator("#cvv").fill("111");
  if (await f.locator("#postalCode").count())
    await f.locator("#postalCode").fill("66534");
}
const payButton = (p) => p.getByRole("button", { name: /^Pay \$/ });
const add = (p, name) => p.getByRole("button", { name: `Add ${name}` });
const focused = (p) =>
  p.evaluate(() => {
    const el = document.activeElement;
    return (
      el?.getAttribute("aria-labelledby") ||
      el?.getAttribute("autocomplete") ||
      el?.tagName
    );
  });

(async () => {
  const { data: saved, error } = await db
    .from("settings")
    .select("key, value, updated_at")
    .in("key", KEYS);
  if (error) throw error;
  const b = await chromium.launch({ channel: "msedge", headless: true });
  const ctx = await b.newContext({
    ...devices["iPhone 13"],
    deviceScaleFactor: 2,
  });
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    // 1. Closed messages.
    await setting("ignore_hours_for_demo", false);
    await setting("kitchen_status", "open");
    await p.goto(`${base}/order?hole=5`, { waitUntil: "networkidle" });
    if (await p.getByRole("heading", { name: "Clubhouse hours" }).count()) {
      const msg = await p.locator("[role=status]:visible").first().innerText();
      console.log("1 after hours:", msg.replace(/\n/g, " | "));
      check(
        "says when ordering opens",
        /Ordering opens (today|tomorrow|\w+day|next \w+day) at \d/.test(msg),
      );
      check("tap-to-call", (await p.locator('a[href^="tel:"]').count()) > 0);
    } else {
      console.log(
        "1 after hours: clubhouse is open right now; closed-hours message not shown (covered by unit tests)",
      );
    }
    await setting("ignore_hours_for_demo", true);
    await setting("kitchen_status", "closed");
    await p.goto(`${base}/order`, { waitUntil: "networkidle" });
    console.log(
      "  kitchen closed:",
      (await p.locator("main").innerText()).split("\n").slice(-3).join(" | "),
    );
    check(
      "kitchen closed: no weekly hours",
      (await p.getByRole("heading", { name: "Clubhouse hours" }).count()) === 0,
    );
    check(
      "kitchen closed: tap-to-call",
      (await p.locator('main a[href^="tel:"]:visible').count()) === 1,
    );
    await p.screenshot({
      path: `${shotDir}/order-kitchen-closed.png`,
      fullPage: true,
    });

    // 2. Slow network: "+" looks disabled with a hint until hydrated, then works.
    await setting("kitchen_status", "open");
    const cdp = await ctx.newCDPSession(p);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 400,
      downloadThroughput: (400 * 1024) / 8,
      uploadThroughput: (400 * 1024) / 8,
    });
    await p.goto(`${base}/order?hole=5`, { waitUntil: "commit" });
    const beer = add(p, "Domestic beer (can)");
    await beer.waitFor({ timeout: 60000 });
    const early = await beer.isDisabled();
    const hint = await p
      .getByText("Loading… the + buttons work")
      .filter({ visible: true })
      .count();
    console.log(
      "2 throttled: + disabled before hydration:",
      early,
      "| hint:",
      hint === 1,
    );
    await p.screenshot({ path: `${shotDir}/order-throttled-early.png` });
    await beer.click({ timeout: 90000 }); // Waits until enabled.
    check(
      "early tap not lost once hydrated",
      (await p
        .getByRole("button", { name: "One less Domestic beer (can)" })
        .count()) === 1,
    );
    check(
      "hint gone after hydration",
      (await p
        .getByText("Loading… the + buttons work")
        .filter({ visible: true })
        .count()) === 0,
    );
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });

    // 3. First order to hole 5; validation focus.
    check(
      "'Keep playing' once a hole is chosen",
      (await p.getByText("Keep playing.").filter({ visible: true }).count()) ===
        1,
    );
    await add(p, "Bottled water").click();
    await add(p, "Bottled water").click();
    await p.getByRole("button", { name: /^Checkout/ }).click();
    const sec = p.locator("section[aria-labelledby=checkout-heading]:visible");
    console.log("3 checkout:", await sec.locator("p").first().innerText());
    const change = sec.getByRole("button", { name: "Change hole" });
    const box = await change.boundingBox();
    check(
      "checkout Change is ≥44px",
      box.height >= 44 && box.width >= 44,
      `${box.width}x${box.height}`,
    );
    const topBox = await p
      .getByRole("button", { name: "Change hole" })
      .first()
      .boundingBox();
    check(
      "top Change is ≥44px",
      topBox.height >= 44,
      `${topBox.width}x${topBox.height}`,
    );
    await p.getByLabel("Name").fill("");
    await p.getByLabel("Phone").fill("");
    await fillCard(p, "4111 1111 1111 1111");
    await payButton(p).click();
    await p.waitForTimeout(800);
    check(
      "empty name -> focused + aria-invalid",
      (await focused(p)) === "name" &&
        (await p.getByLabel("Name").getAttribute("aria-invalid")) === "true",
    );
    check(
      "aria-describedby -> message",
      (await p.locator("#name-error").innerText()) === "Enter your name",
    );
    await p.screenshot({ path: `${shotDir}/order-error-name.png` });
    await p.getByLabel("Name").fill(NAME);
    check(
      "error clears as the field changes",
      (await p.locator("#name-error").count()) === 0,
    );
    await payButton(p).click();
    await p.waitForTimeout(800);
    check("bad phone -> phone focused", (await focused(p)) === "tel");
    await p.getByLabel("Phone").fill(PHONE);
    await p.screenshot({
      path: `${shotDir}/order-checkout.png`,
      fullPage: true,
    });
    await payButton(p).click();
    await p.waitForURL(/\/order\/status\//, { timeout: 90000 });
    const id1 = p.url().split("/").pop();
    await p.getByText("Received").filter({ visible: true }).waitFor();
    const tel = p.locator('main a[href^="tel:"]:visible');
    console.log(
      "  status:",
      (await p.locator("main").innerText())
        .replace(/\n+/g, " | ")
        .slice(0, 300),
    );
    check(
      "status: tap-to-call",
      (await tel.count()) === 1 &&
        /Moved holes or need something\?/.test(
          await p.locator("main").innerText(),
        ),
      await tel.getAttribute("href"),
    );
    check(
      "status: delivery time from settings",
      /Usually (about )?\d+(–\d+)? minutes\. Keep playing — we'll find you by name\./.test(
        await p.locator("main").innerText(),
      ),
    );
    check(
      "'Order something else' has no hole",
      (await p
        .getByRole("link", { name: "Order something else" })
        .getAttribute("href")) === "/order",
    );
    await p.screenshot({ path: `${shotDir}/order-status.png`, fullPage: true });

    // 4. Offline status page: "Checking…" after 2 failed polls.
    await ctx.setOffline(true);
    await p
      .getByText("Checking…")
      .filter({ visible: true })
      .first()
      .waitFor({ timeout: 20000 });
    console.log("4 offline -> shows Checking…");
    await p.screenshot({
      path: `${shotDir}/order-status-offline.png`,
      fullPage: true,
    });
    await ctx.setOffline(false);
    await db
      .from("orders")
      .update({ status: "preparing", updated_at: new Date().toISOString() })
      .eq("id", id1);
    await p.waitForFunction(
      () =>
        document
          .querySelector("[aria-current=step]")
          ?.textContent?.includes("Preparing"),
      null,
      { timeout: 20000 },
    );
    check(
      "back online -> updates, Checking… gone",
      (await p.getByText("Checking…").filter({ visible: true }).count()) === 0,
    );

    // 5. Order something else -> fresh menu; second order from /order (no hole).
    await p.getByRole("link", { name: "Order something else" }).click();
    await p.waitForURL(/\/order$/);
    await p.getByRole("heading", { name: "Which hole are you on?" }).waitFor();
    check(
      "no hole pre-selected",
      (await p.locator("[aria-pressed=true]:visible").count()) === 0,
    );
    check(
      "no old quantities",
      (await p.getByRole("button", { name: /^One less/ }).count()) === 0,
    );
    await add(p, "Soda (can)").click();
    await p.getByRole("button", { name: /^Checkout/ }).click();
    check(
      "hole picker inside checkout",
      (await sec.getByRole("group").count()) === 1,
    );
    check(
      "name/phone remembered",
      (await p.getByLabel("Name").inputValue()) === NAME &&
        (await p.getByLabel("Phone").inputValue()) === PHONE,
    );
    await fillCard(p, "4111 1111 1111 1111");
    await payButton(p).click();
    await p.waitForTimeout(800);
    check(
      "no hole -> hole picker focused",
      (await focused(p)) === "checkout-hole-heading" &&
        (await p.locator("#hole-error").count()) === 1,
    );
    await p.screenshot({
      path: `${shotDir}/order-pick-hole.png`,
      fullPage: true,
    });
    await sec.getByRole("button", { name: "3", exact: true }).click();
    check(
      "summary: Deliver to hole 3",
      (await sec
        .getByText("Deliver to hole 3")
        .filter({ visible: true })
        .count()) === 1 && (await p.locator("#hole-error").count()) === 0,
    );
    await payButton(p).click();
    await p.waitForURL(/\/order\/status\//, { timeout: 90000 });
    await p.getByText("Received").filter({ visible: true }).waitFor();
    console.log(
      "5 second order placed to hole",
      await p.locator("main strong:visible").first().innerText(),
    );

    // 6. Back never shows a frozen form.
    await p.getByRole("link", { name: "Order something else" }).click();
    await p.waitForURL(/\/order$/);
    await p.getByRole("heading", { name: "Which hole are you on?" }).waitFor();
    check(
      "again fresh (no hole, nothing paying)",
      (await p.locator("[aria-pressed=true]:visible").count()) === 0 &&
        (await p
          .getByText("Placing order…")
          .filter({ visible: true })
          .count()) === 0,
    );
    await p.goBack();
    await p.waitForURL(/\/order\/status\//);
    console.log(
      "6 Back from new order ->",
      new URL(p.url()).pathname.slice(0, 20) + "…",
    );
    await p.goBack();
    await p.waitForTimeout(1500);
    const url = new URL(p.url()).pathname;
    const frozen = await p
      .getByText("Placing order…")
      .filter({ visible: true })
      .count();
    console.log("  Back again ->", url, "| frozen 'Placing order…':", frozen);
    check("never a frozen form", frozen === 0);
    await p.goForward();
    await p.goForward();
    await p.waitForURL(/\/order$/);
    await add(p, "Gatorade").click();
    check(
      "forward to /order: usable menu",
      (await p.getByRole("button", { name: /^Checkout · 1 item/ }).count()) ===
        1,
    );
    await p.screenshot({
      path: `${shotDir}/order-after-back.png`,
      fullPage: true,
    });

    // 7. Bottom bar comes back when the checkout is off screen.
    await p.goto(`${base}/order?hole=5`, { waitUntil: "networkidle" });
    await add(p, "Hot Dog").click();
    await add(p, "Seltzer (can)").click();
    await p.getByRole("button", { name: /^Checkout/ }).click();
    await p.waitForTimeout(1000);
    check(
      "bar hidden while checkout is on screen",
      (await p.getByRole("button", { name: /^Go to checkout/ }).count()) === 0,
    );
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(500);
    const bar = p.getByRole("button", { name: /^Go to checkout/ });
    check(
      "bar back after scrolling up",
      (await bar.count()) === 1,
      await bar.innerText().catch(() => ""),
    );
    await p.screenshot({ path: `${shotDir}/order-go-to-checkout.png` });
    await bar.click();
    await p.waitForTimeout(1200);
    check(
      "Go to checkout scrolls there",
      (await bar.count()) === 0 &&
        (await p.locator("#checkout-heading").isVisible()),
    );

    // 8. Kitchen flips to Drinks only mid-order: the Hot Dog is named.
    await setting("kitchen_status", "drinks_only");
    await fillCard(p, "4111 1111 1111 1111");
    await payButton(p).click();
    const alert = p.locator("[role=alert]:visible", {
      hasText: "available right now",
    });
    await alert.waitFor({ timeout: 60000 });
    console.log("8 unavailable:", await alert.locator("p").innerText());
    check(
      "names the item",
      /^Hot Dog isn't available right now \(kitchen closed\)\. Remove it to continue\.$/.test(
        await alert.locator("p").innerText(),
      ),
    );
    await p
      .getByText("Drinks only.")
      .filter({ visible: true })
      .waitFor({ timeout: 20000 });
    check(
      "menu refreshed to drinks",
      (await p.locator("section h2[id^=cat-]:visible").allInnerTexts()).join(
        ",",
      ) === "Drinks",
    );
    check(
      "drinks only: tap-to-call",
      (await p.locator('main a[href^="tel:"]:visible').count()) === 1,
    );
    await p.screenshot({
      path: `${shotDir}/order-unavailable.png`,
      fullPage: true,
    });
    await p.getByRole("button", { name: "Remove unavailable items" }).click();
    check(
      "removed; error cleared",
      (await alert.count()) === 0 &&
        (await sec.getByText("Hot Dog").filter({ visible: true }).count()) ===
          0,
    );

    // 9. Decline.
    await fillCard(p, "4000 0000 0000 0002");
    await payButton(p).click();
    console.log(
      "9 declined:",
      await sec
        .locator("[role=alert]:visible", { hasText: /\w/ })
        .first()
        .innerText({ timeout: 90000 }),
    );
    check("pay button usable again", await payButton(p).isEnabled());

    // 10. Cancelled wording.
    await db
      .from("orders")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id1);
    await p.goto(`${base}/order/status/${id1}`, { waitUntil: "networkidle" });
    const cancelled = await p
      .locator("[role=status]:visible")
      .first()
      .innerText();
    console.log("10 cancelled:", cancelled.replace(/\n/g, " | "));
    check(
      "cancelled: refund + phone",
      /If you were charged, the clubhouse will refund you/.test(cancelled) &&
        (await p.locator('[role=status] a[href^="tel:"]:visible').count()) ===
          1,
    );
    console.log("page errors:", errs.length ? errs : "none");
    if (errs.length) process.exitCode = 1;
  } finally {
    await p
      .screenshot({ path: `${shotDir}/order-last.png`, fullPage: true })
      .catch(() => {});
    await b.close();
    // Put both settings back exactly as they were (value and updated_at).
    for (const row of saved) {
      await db
        .from("settings")
        .update({ value: row.value, updated_at: row.updated_at })
        .eq("key", row.key);
    }
    const { data: gone } = await db
      .from("orders")
      .delete()
      .eq("name", NAME)
      .select("status");
    console.log(
      "cleanup: settings restored",
      JSON.stringify(saved.map((r) => [r.key, r.value])),
      "; deleted orders:",
      (gone || []).map((o) => o.status).join(", "),
    );
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
