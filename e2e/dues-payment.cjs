/**
 * E2E: Dues payment: phone form -> validation -> Square sandbox card -> receipt -> recorded in DB and listed in /admin.
 *
 *   node e2e/dues-payment.cjs [baseUrl]      (default http://localhost:3000; run from the repo root)
 *
 * Drives the installed Microsoft Edge with playwright-core. Uses the DEMO
 * database from .env.local: creates a temporary admin user and a dues row and
 * deletes them afterwards. Square sandbox only: no real money moves.
 * Screenshots go to e2e/.shots (gitignored).
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const { randomBytes } = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const base = process.argv[2] || "http://localhost:3000";
const shotDir = "e2e/.shots";
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
const NAME = `E2E Member ${Date.now()}`;
const EMAIL = `member-${Date.now()}@example.com`;

(async () => {
  let adminId;
  const b = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const { data: tier } = await db
      .from("membership_tiers")
      .select("price_cents")
      .eq("name", "Single")
      .single();

    // 1. Pay the first half on a phone.
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    await p.goto(`${base}/memberships`);
    await p.getByRole("link", { name: "Pay dues online" }).click();
    await p.waitForURL(/\/memberships\/dues$/);
    await p.getByRole("radio", { name: /Single/ }).waitFor();
    await p.getByRole("button", { name: "Continue to payment" }).click();
    console.log(
      "1 empty form errors:",
      await p.getByText("Pick your membership type").count(),
      await p.getByText("Enter the member's name").count(),
    );
    await p.getByRole("radio", { name: /Single/ }).check();
    await p.getByRole("button", { name: /First half/ }).click();
    await p.getByLabel("Member name").fill(NAME);
    await p.getByLabel("Email").fill(EMAIL);
    console.log(
      "2 total shown:",
      (await p.getByLabel("Total").innerText()).replace(/\s+/g, " "),
      "| tier price",
      tier.price_cents,
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

    // Editing the form after Continue keeps the typed card; Pay re-checks the form.
    await p.getByLabel("Email").fill("");
    await p.getByRole("button", { name: /^Pay \$/ }).click();
    await p.getByText("Enter a valid email").waitFor();
    console.log(
      "2b edit after Continue: card kept:",
      (await f.locator("#cardNumber").inputValue()).replace(/\D/g, "") ===
        "4111111111111111",
      "| still on form:",
      /\/memberships\/dues$/.test(p.url()),
      "| email focused:",
      await p.evaluate(() => document.activeElement?.type),
    );
    await p.getByLabel("Email").fill(EMAIL);
    await p.getByRole("button", { name: /^Pay \$/ }).click();
    await p.waitForURL(/\/memberships\/dues\/receipt\//, { timeout: 90000 });
    await p.getByRole("heading", { name: "Dues receipt" }).waitFor();
    await p.screenshot({ path: `${shotDir}/dues-receipt.png` });
    console.log(
      "3 receipt:",
      (await p.locator("dl", { hasText: "Membership" }).innerText())
        .replace(/\s+/g, " ")
        .replace(EMAIL, "<email>")
        .replace(NAME, "<name>"),
    );

    const { data: row } = await db
      .from("dues_payments")
      .select("installment, amount_cents, payment_id")
      .eq("email", EMAIL)
      .single();
    console.log(
      "4 recorded:",
      row.installment,
      row.amount_cents,
      row.amount_cents === Math.floor(tier.price_cents / 2),
      "payment_id set:",
      !!row.payment_id,
    );

    // 2. Admin sees it.
    const password = randomBytes(18).toString("base64url");
    const { data: created, error } = await db.auth.admin.createUser({
      email: `admin-test-${Date.now()}@example.com`,
      password,
      email_confirm: true,
      app_metadata: { role: "admin" },
    });
    if (error) throw error;
    adminId = created.user.id;
    const ap = await b.newPage({ viewport: { width: 1024, height: 768 } });
    await ap.goto(`${base}/admin`);
    await ap.getByLabel("Email").fill(created.user.email);
    await ap.getByLabel("Password").fill(password);
    await ap.getByRole("button", { name: "Sign in" }).click();
    await ap.waitForURL(/\/admin$/, { timeout: 30000 });
    const tr = ap.locator("tr", { hasText: NAME });
    await tr.waitFor({ timeout: 30000 });
    console.log(
      "5 admin row:",
      (await tr.innerText())
        .replace(/\s+/g, " ")
        .replace(EMAIL, "<email>")
        .replace(NAME, "<name>"),
    );
  } finally {
    await b.close();
    await db.from("dues_payments").delete().eq("email", EMAIL);
    if (adminId) await db.auth.admin.deleteUser(adminId);
    console.log("test rows and users deleted");
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
