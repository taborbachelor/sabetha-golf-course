/**
 * E2E: Membership application: phone form -> validation -> received page -> listed in /admin -> approve; staff can't open /admin.
 *
 *   node e2e/membership-apply.cjs [baseUrl]      (default http://localhost:3000; run from the repo root)
 *
 * Drives the installed Microsoft Edge with playwright-core. Uses the DEMO
 * database from .env.local: creates temporary users and an application and
 * deletes them afterwards. Screenshots go to e2e/.shots (gitignored).
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const { randomBytes, randomUUID } = require("crypto");
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
const NAME = `E2E Applicant ${Date.now()}`;
const EMAIL = `applicant-${Date.now()}@example.com`;

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

async function signIn(page, user, next) {
  await page.goto(`${base}${next}`);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

(async () => {
  const users = [];
  let duesId;
  const b = await chromium.launch({ channel: "msedge", headless: true });
  try {
    // 1. Apply on a phone.
    const phone = await b.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto(`${base}/memberships`);
    await phone.getByRole("link", { name: "Apply online" }).click();
    await phone.waitForURL(/\/memberships\/apply$/);
    await phone.getByRole("radio", { name: /Single/ }).waitFor();
    await phone.getByLabel("Full name").fill(NAME);
    await phone.getByLabel("Mailing address").fill("123 Main St\nSabetha, KS");
    await phone.getByLabel("Phone").fill("555-0100");
    await phone.getByLabel("Email").fill(EMAIL);
    await phone.getByRole("button", { name: "Send application" }).click();
    await phone.getByText("Pick a membership type").first().waitFor();
    console.log(
      "1 no type -> error, name kept:",
      (await phone.getByLabel("Full name").inputValue()) === NAME,
    );
    await phone.getByRole("radio", { name: /Single/ }).check();
    await phone.getByRole("button", { name: "Send application" }).click();
    await phone.getByText("Enter a 10-digit phone number").first().waitFor();
    console.log(
      "2 short phone -> error, type kept:",
      await phone.getByRole("radio", { name: /Single/ }).isChecked(),
    );
    await phone.screenshot({
      path: `${shotDir}/membership-apply-error.png`,
      fullPage: true,
    });
    await phone.getByLabel("Phone").fill("785-555-0100");
    await phone.getByLabel(/Cart Shed/).check();
    await phone.getByRole("button", { name: "Send application" }).click();
    await phone.waitForURL(/\/memberships\/apply\/received\//, {
      timeout: 30000,
    });
    await phone
      .getByRole("heading", { name: "Application received" })
      .waitFor({ timeout: 30000 });
    await phone.screenshot({ path: `${shotDir}/membership-received.png` });
    console.log(
      "3 received:",
      (
        await phone.locator("dl", { hasText: "Membership type" }).innerText()
      ).replace(/\s+/g, " "),
    );

    const { data: row } = await db
      .from("membership_applications")
      .select("id, status, cart_shed, address")
      .eq("email", EMAIL)
      .single();
    console.log("4 saved:", row.status, "cart_shed", row.cart_shed);

    // 2. Staff (not admin) is kept out of /admin.
    const staff = await makeUser("staff");
    users.push(staff);
    const sp = await b.newPage();
    await signIn(sp, staff, "/admin");
    await sp.waitForURL(/\/staff$/, { timeout: 30000 });
    console.log("5 staff /admin ->", new URL(sp.url()).pathname);

    // They pay the first half online (email typed in different case).
    const { data: tier } = await db
      .from("membership_tiers")
      .select("id")
      .eq("name", "Single")
      .single();
    duesId = randomUUID();
    const { error: duesError } = await db.from("dues_payments").insert({
      id: duesId,
      member_name: NAME,
      email: EMAIL.toUpperCase(),
      tier_id: tier.id,
      installment: "first",
      amount_cents: 20000,
      payment_id: "e2e-test",
    });
    if (duesError) throw new Error(duesError.message);

    // 3. Admin sees and approves it.
    const admin = await makeUser("admin");
    users.push(admin);
    const ap = await b.newPage({ viewport: { width: 1024, height: 768 } });
    await signIn(ap, admin, "/admin");
    await ap.waitForURL(/\/admin$/, { timeout: 30000 });
    const card = ap.getByRole("listitem", { name: `Application from ${NAME}` });
    await card.waitFor({ timeout: 30000 });
    console.log(
      "6 listed in admin:",
      (await card.innerText()).split("\n").slice(0, 3).join(" | "),
    );
    await ap.screenshot({ path: `${shotDir}/admin-applications.png` });
    await card.getByRole("button", { name: "Approve" }).click();
    console.log(
      "7 confirmation:",
      await ap
        .getByRole("status")
        .filter({ hasText: "Approved" })
        .innerText({ timeout: 30000 }),
    );
    // Approved ones fold into "Past applications (N)".
    const past = ap.locator("details", { hasText: "Past applications" });
    console.log(
      "7 folded:",
      (await past.locator("summary").innerText()).trim(),
      "| open:",
      await past.evaluate((d) => d.open),
    );
    await past.locator("summary").click();
    await card
      .getByRole("button", { name: "Mark as new" })
      .waitFor({ timeout: 30000 });
    console.log(
      "7 badge:",
      await card.locator("span.rounded-full").innerText(),
    );
    console.log(
      "7 card next step + dues:",
      (await card.locator("div.bg-stone-50").innerText()).replace(/\s+/g, " "),
    );
    await ap.screenshot({
      path: `${shotDir}/admin-applications-approved.png`,
      fullPage: true,
    });
    const { data: after } = await db
      .from("membership_applications")
      .select("status")
      .eq("id", row.id)
      .single();
    console.log("7 in DB:", after.status);

    // 4. The received page isn't guessable.
    const res = await phone.goto(
      `${base}/memberships/apply/received/00000000-0000-4000-8000-000000000000`,
    );
    console.log(
      "8 unknown id ->",
      res.status(),
      await phone.getByRole("heading", { level: 1 }).first().innerText(),
    );
  } finally {
    await b.close();
    await db.from("membership_applications").delete().eq("email", EMAIL);
    if (duesId) await db.from("dues_payments").delete().eq("id", duesId);
    for (const u of users) await db.auth.admin.deleteUser(u.id);
    console.log("test rows and users deleted");
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
