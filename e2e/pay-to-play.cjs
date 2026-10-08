/**
 * E2E: Pay to Play sandbox card checkout.
 *
 *   node e2e/pay-to-play.cjs [baseUrl] [cardNumber]
 *
 * baseUrl defaults to http://localhost:3000 (run from the repo root).
 * Pass Square's decline card 4000000000000002 as cardNumber to test declines.
 * Drives the installed Microsoft Edge with playwright-core against the DEMO
 * database from .env.local, and deletes the "Test Golfer" rounds afterwards.
 * Square sandbox only. Screenshots go to e2e/.shots (gitignored).
 */
const fs = require("fs");
const { chromium } = require("playwright-core");
const { createClient } = require("@supabase/supabase-js");

const base = process.argv[2] || "http://localhost:3000";
const cardNumber = process.argv[3] || "4111 1111 1111 1111";
const shotDir = "e2e/.shots";
fs.mkdirSync(shotDir, { recursive: true });
const shot = `${shotDir}/pay-to-play.png`;

const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.trim().match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function cleanup() {
  const { data: rounds } = await db
    .from("rounds")
    .select("id")
    .eq("name", "Test Golfer");
  const ids = (rounds || []).map((r) => r.id);
  if (ids.length) {
    await db.from("cart_sessions").delete().in("round_id", ids);
    await db.from("rounds").delete().in("id", ids);
  }
  console.log("cleanup: deleted", ids.length, "test round(s)");
}

(async () => {
  const b = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    await p.goto(`${base}/pay`, { waitUntil: "networkidle" });
    await p.getByRole("button", { name: "18 holes", exact: true }).click();
    await p.getByRole("button", { name: "More players" }).click(); // 2 players
    await p.getByRole("button", { name: "More carts" }).click(); // 1 cart
    await p.getByRole("button", { name: "Now", exact: true }).click(); // any hour, never after midnight
    await p.getByLabel("Name").fill("Test Golfer");
    await p.getByLabel("Phone").fill("785-555-0100");
    await p.getByLabel("Email").fill("test@example.com");
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
    const frame = p.frameLocator("iframe.sq-card-component");
    await frame.locator("#cardNumber").waitFor({ timeout: 60000 });
    await frame.locator("#cardNumber").fill(cardNumber);
    await frame.locator("#expirationDate").fill("12/30");
    await frame.locator("#cvv").fill("111");
    const zip = frame.locator("#postalCode");
    if (await zip.count()) await zip.fill("66534");
    const payBtn = p.getByRole("button", { name: /^Pay \$/ });
    console.log("pay button:", await payBtn.innerText());
    await payBtn.click();

    const outcome = await Promise.race([
      p
        .waitForURL(/\/pay\/receipt\//, { timeout: 90000 })
        .then(() => "receipt"),
      p
        .locator("p[role=alert]")
        .first()
        .waitFor({ timeout: 90000 })
        .then(() => "alert"),
    ]);
    if (outcome === "receipt") {
      await p.getByText("Paid. You're all set.").waitFor({ timeout: 20000 });
      console.log("receipt url:", p.url().replace(base, ""));
      console.log(
        "receipt:",
        (await p.locator("main").innerText())
          .replace(/\n+/g, " | ")
          .slice(0, 400),
      );
    } else {
      console.log(
        "alert:",
        await p.locator("p[role=alert]").first().innerText(),
      );
    }
    await p.screenshot({ path: shot, fullPage: true });
    console.log("page errors:", errs.length ? errs : "none");
  } finally {
    await b.close();
    await cleanup();
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
