/**
 * E2E: Order to the Course: closed after hours, demo switch, order to hole 5, live status, drinks only, decline.
 *
 *   node e2e/order-to-course.cjs [baseUrl]      (default http://localhost:3000; run from the repo root)
 *
 * Drives the installed Microsoft Edge with playwright-core. Uses the DEMO
 * database from .env.local: creates temporary users/rows and deletes them
 * afterwards, and resets kitchen_status / ignore_hours_for_demo. Square sandbox only.
 * Screenshots go to e2e/.shots (gitignored).
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
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
const setting = (key, value) =>
  db.from("settings").update({ value }).eq("key", key);
const NAME = "Order Tester";

async function pay(p, card) {
  await p.getByLabel("Name").fill(NAME);
  await p.getByLabel("Phone").fill("785-555-0100");
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
  await p.getByRole("button", { name: /^Pay \$/ }).click();
}

(async () => {
  const b = await chromium.launch({ channel: "msedge", headless: true });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  try {
    await setting("ignore_hours_for_demo", false);
    await setting("kitchen_status", "open");
    await p.goto(`${base}/order?hole=5`, { waitUntil: "networkidle" });
    console.log(
      "1 after hours:",
      await p.locator("p[role=status]").first().innerText(),
    );

    await setting("ignore_hours_for_demo", true);
    await p.goto(`${base}/order?hole=5`, { waitUntil: "networkidle" });
    console.log(
      "2 demo mode:",
      await p.getByRole("heading", { level: 2 }).first().innerText(),
      "| sections:",
      (await p.locator("section h2[id^=cat-]").allInnerTexts()).join(", "),
    );
    await p.getByRole("button", { name: "Add Domestic beer (can)" }).click();
    await p.getByRole("button", { name: "Add Bottled water" }).click();
    await p.getByRole("button", { name: "Add Bottled water" }).click();
    console.log(
      "  bar:",
      await p.getByRole("button", { name: /^Checkout/ }).innerText(),
    );
    await p.getByRole("button", { name: /^Checkout/ }).click();
    console.log(
      "  21+ note:",
      (await p.getByText("21+. We'll check ID").count()) === 1,
    );
    await p.screenshot({
      path: `${shotDir}/order-checkout.png`,
      fullPage: true,
    });
    await pay(p, "4111 1111 1111 1111");
    await p.waitForURL(/\/order\/status\//, { timeout: 90000 });
    const id = p.url().split("/").pop();
    await p.getByText("Received").waitFor();
    console.log(
      "3 status page:",
      (await p.locator("main").innerText())
        .replace(/\n+/g, " | ")
        .slice(0, 230),
    );
    const { data: row } = await db
      .from("orders")
      .select("code,status,hole,total_cents,has_alcohol,payment_id")
      .eq("id", id)
      .single();
    console.log(
      "  db:",
      JSON.stringify({ ...row, payment_id: !!row.payment_id }),
    );

    for (const status of ["preparing", "out_for_delivery", "delivered"]) {
      const t0 = Date.now();
      await db
        .from("orders")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      await p.waitForFunction(
        (s) =>
          document
            .querySelector("[aria-current=step]")
            ?.textContent?.includes(s) ||
          (s === "Delivered" &&
            [...document.querySelectorAll("ol li")]
              .at(-1)
              ?.textContent?.includes("Delivered") &&
            document.querySelectorAll("ol li span.bg-green-800").length === 4),
        {
          Preparing: "Preparing",
          out_for_delivery: "On the way",
          delivered: "Delivered",
          preparing: "Preparing",
        }[status],
        { timeout: 20000 },
      );
      console.log(
        `4 ${status} -> page updated in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
      );
    }
    await p.screenshot({
      path: `${shotDir}/order-delivered.png`,
      fullPage: true,
    });

    await setting("kitchen_status", "drinks_only");
    await p.goto(`${base}/order?hole=5`, { waitUntil: "networkidle" });
    console.log(
      "5 drinks only:",
      (await p.locator("section h2[id^=cat-]").allInnerTexts()).join(", "),
      "|",
      (await p.getByText("Drinks only.").count()) === 1,
    );

    await setting("kitchen_status", "open");
    await p.goto(`${base}/order?hole=2`, { waitUntil: "networkidle" });
    await p.getByRole("button", { name: "Add Soda (can)" }).click();
    await p.getByRole("button", { name: /^Checkout/ }).click();
    await pay(p, "4000 0000 0000 0002");
    console.log(
      "6 declined:",
      await p.locator("p[role=alert]").first().innerText({ timeout: 90000 }),
    );
    console.log("page errors:", errs.length ? errs : "none");
  } finally {
    await b.close();
    await setting("ignore_hours_for_demo", false);
    await setting("kitchen_status", "open");
    const { data: gone } = await db
      .from("orders")
      .delete()
      .eq("name", NAME)
      .select("status");
    console.log(
      "cleanup: settings reset; deleted orders:",
      gone.map((o) => o.status).join(", "),
    );
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
