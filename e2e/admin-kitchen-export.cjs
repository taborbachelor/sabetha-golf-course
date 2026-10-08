/**
 * E2E: Kitchen default + CSV export.
 *  - Admin sets "Drinks only" as the daily default; a kitchen status staff set on an earlier day is ignored, so /order offers drinks only.
 *  - CSV downloads for rounds, orders and dues: admin gets the file, staff get 403, formula-looking names are neutralised.
 *
 *   node e2e/admin-kitchen-export.cjs [baseUrl]      (default http://localhost:3000; run from the repo root)
 *
 * Drives the installed Microsoft Edge with playwright-core. Uses the DEMO
 * database from .env.local: creates temporary users and rows, deletes them
 * afterwards, and puts kitchen_status / kitchen_default / ignore_hours_for_demo back.
 * Don't pipe this into `head`: that kills it before the cleanup runs.
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
const TAG = Date.now() % 100000;
const NAME = `=E2E Export ${TAG}`;
const EMAIL = `export-${TAG}@example.com`;
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
}).format(new Date());

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
  const { data: saved } = await db
    .from("settings")
    .select("key, value, updated_at")
    .in("key", [
      "kitchen_status",
      "kitchen_default",
      "ignore_hours_for_demo",
      "delivery_minutes",
    ]);
  const ids = {
    round: randomUUID(),
    refunded: randomUUID(),
    order: randomUUID(),
    dues: randomUUID(),
  };
  const b = await chromium.launch({ channel: "msedge", headless: true });
  try {
    // 1. Kitchen default.
    const admin = await makeUser("admin");
    users.push(admin);
    const ap = await b.newPage({ viewport: { width: 1024, height: 900 } });
    await signIn(ap, admin, "/admin/settings");
    await ap.waitForURL(/\/admin\/settings$/, { timeout: 90000 });
    const kitchenForm = ap.getByRole("form", { name: "Order to the Course" });
    const saveOrdering = kitchenForm.getByRole("button", {
      name: "Save ordering default",
    });
    await kitchenForm.getByLabel("Drinks only").check();
    // A backwards delivery time is explained and its box focused.
    await kitchenForm.getByLabel("Shortest delivery time").fill("25");
    await kitchenForm.getByLabel("Longest delivery time").fill("15");
    await saveOrdering.click();
    console.log(
      "1 bad delivery time:",
      await kitchenForm.getByRole("alert").innerText({ timeout: 30000 }),
      "| focused:",
      await ap.evaluate(() => document.activeElement?.getAttribute("name")),
    );
    // Save the defaults (10-20), so the cached settings match once the row
    // is removed again in cleanup.
    await kitchenForm.getByLabel("Shortest delivery time").fill("10");
    await kitchenForm.getByLabel("Longest delivery time").fill("20");
    await saveOrdering.click();
    console.log(
      "1 default:",
      await kitchenForm.getByRole("status").innerText({ timeout: 30000 }),
    );
    console.log(
      "1 delivery_minutes row:",
      JSON.stringify(
        (
          await db
            .from("settings")
            .select("value")
            .eq("key", "delivery_minutes")
            .single()
        ).data?.value,
      ),
    );

    // Staff closed ordering yesterday; today the default applies.
    await db
      .from("settings")
      .update({
        value: "closed",
        updated_at: new Date(Date.now() - 36 * 3600_000).toISOString(),
      })
      .eq("key", "kitchen_status");
    await db
      .from("settings")
      .update({ value: true })
      .eq("key", "ignore_hours_for_demo");
    const phone = await b.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto(`${base}/order?hole=5`);
    await phone
      .getByRole("button", { name: "Add Bottled water" })
      .waitFor({ timeout: 30000 });
    console.log(
      "2 /order with yesterday's 'closed': water offered, hot dog offered:",
      await phone.getByRole("button", { name: "Add Bottled water" }).count(),
      await phone.getByRole("button", { name: "Add Hot Dog" }).count(),
    );

    // Set today, staff's choice wins.
    await db
      .from("settings")
      .update({ value: "closed", updated_at: new Date().toISOString() })
      .eq("key", "kitchen_status");
    await phone.reload();
    console.log(
      "3 /order with today's 'closed':",
      (await phone.getByRole("status").first().innerText()).trim(),
    );

    // 2. CSV export.
    const ins = async (table, row) => {
      const { error } = await db.from(table).insert(row);
      if (error) throw new Error(`${table}: ${error.message}`);
    };
    await ins("rounds", {
      id: ids.round,
      play_date: today,
      holes: 9,
      players: 2,
      carts: 1,
      name: NAME,
      phone: "785-555-0100",
      email: EMAIL,
      arrival_time: "Now",
      arrive_at: new Date().toISOString(),
      amount_cents: 5500,
      status: "paid",
      code: `R-E${TAG}`.slice(0, 12),
      payment_id: "e2e-test",
    });
    // Refunded, and for a day next month: listed by when it was paid.
    await ins("rounds", {
      id: ids.refunded,
      play_date: `${today.slice(0, 5)}${String((Number(today.slice(5, 7)) % 12) + 1).padStart(2, "0")}-01`,
      holes: 18,
      players: 1,
      carts: 0,
      name: `${NAME} refund`,
      phone: "785-555-0100",
      email: EMAIL,
      arrival_time: "Now",
      arrive_at: new Date().toISOString(),
      amount_cents: 3000,
      status: "refunded",
      code: `R-F${TAG}`.slice(0, 12),
      payment_id: "e2e-test-2",
    });
    await ins("orders", {
      id: ids.order,
      hole: 5,
      name: NAME,
      phone: "785-555-0100",
      items: [
        {
          id: randomUUID(),
          name: "Domestic beer (can)",
          qty: 2,
          price_cents: 400,
          is_alcohol: true,
        },
        {
          id: randomUUID(),
          name: "Bottled water",
          qty: 1,
          price_cents: 150,
          is_alcohol: false,
        },
      ],
      total_cents: 950,
      has_alcohol: true,
      status: "delivered",
      code: `O-E${TAG}`.slice(0, 12),
      payment_id: "e2e-test",
    });
    const { data: tier } = await db
      .from("membership_tiers")
      .select("id")
      .eq("name", "Single")
      .single();
    await ins("dues_payments", {
      id: ids.dues,
      member_name: NAME,
      email: EMAIL,
      tier_id: tier.id,
      installment: "first",
      amount_cents: 20000,
      payment_id: "e2e-test",
    });

    await ap.getByRole("link", { name: "Export" }).click();
    await ap.waitForURL(/\/admin\/export$/);
    console.log(
      "4 default range:",
      await ap.getByLabel("From", { exact: true }).inputValue(),
      "to",
      await ap.getByLabel("To", { exact: true }).inputValue(),
      "| To min:",
      await ap.getByLabel("To", { exact: true }).getAttribute("min"),
    );
    await ap
      .getByText(/\d+ rows?/)
      .first()
      .waitFor({ timeout: 30000 });
    console.log(
      "4 counts:",
      (await ap.locator("form li").allInnerTexts()).map((t) =>
        t.replace(/\s+/g, " "),
      ),
    );
    for (const kind of ["rounds", "orders", "dues"]) {
      const [download] = await Promise.all([
        ap.waitForEvent("download"),
        ap
          .getByRole("button", { name: new RegExp(`^Download`) })
          .nth(["rounds", "orders", "dues"].indexOf(kind))
          .click(),
      ]);
      const text = fs.readFileSync(await download.path(), "utf8");
      const line =
        text.split("\r\n").find((l) => l.includes(`E2E Export ${TAG}`)) ??
        "(missing)";
      console.log(
        `4 ${kind}: ${download.suggestedFilename()} | header: ${text.replace(/^﻿/, "").split("\r\n")[0]}`,
      );
      console.log(`  row: ${line.replace(EMAIL, "<email>")}`);
      if (kind === "rounds") {
        const refund =
          text
            .split("\r\n")
            .find((l) => l.includes(`E2E Export ${TAG} refund`)) ?? "(missing)";
        console.log(`  refunded row: ${refund.replace(EMAIL, "<email>")}`);
      }
    }

    const staff = await makeUser("staff");
    users.push(staff);
    const sp = await b.newPage();
    await signIn(sp, staff, "/staff");
    await sp.waitForURL(/\/staff$/, { timeout: 60000 });
    const res = await sp.request.get(`${base}/admin/export/rounds`);
    console.log("5 staff download ->", res.status());
    await ap.goto(`${base}/admin/export/rounds?from=2026-10-09&to=2026-10-01`);
    console.log(
      "6 backwards dates ->",
      new URL(ap.url()).pathname,
      "|",
      await ap.getByRole("alert").first().innerText({ timeout: 30000 }),
    );
    // Picking a To before From in the form: message, downloads disabled.
    await ap.getByLabel("From", { exact: true }).fill("2026-10-09");
    await ap.getByLabel("To", { exact: true }).fill("2026-10-01");
    console.log(
      "7 form backwards:",
      await ap.getByRole("alert").first().innerText(),
      "| download disabled:",
      await ap
        .getByRole("button", { name: /^Download/ })
        .first()
        .isDisabled(),
    );
    // A range with nothing in it says so before downloading.
    await ap.getByLabel("From", { exact: true }).fill("2020-01-01");
    await ap.getByLabel("To", { exact: true }).fill("2020-01-02");
    await ap
      .getByText(/only have the column headings/)
      .first()
      .waitFor({ timeout: 30000 });
    const [empty] = await Promise.all([
      ap.waitForEvent("download"),
      ap
        .getByRole("button", { name: /^Download/ })
        .first()
        .click(),
    ]);
    console.log(
      "8 empty range:",
      (await ap.locator("form li").first().innerText()).replace(/\s+/g, " "),
      "| file lines:",
      fs
        .readFileSync(await empty.path(), "utf8")
        .trim()
        .split("\r\n").length,
    );
  } catch (e) {
    for (const [i, pg] of b
      .contexts()
      .flatMap((c) => c.pages())
      .entries())
      await pg
        .screenshot({ path: `${shotDir}/admin-kitchen-export-fail-${i}.png` })
        .catch(() => {});
    throw e;
  } finally {
    await b.close();
    await db.from("rounds").delete().in("id", [ids.round, ids.refunded]);
    await db.from("orders").delete().eq("id", ids.order);
    await db.from("dues_payments").delete().eq("id", ids.dues);
    for (const row of saved)
      await db
        .from("settings")
        .update({ value: row.value, updated_at: row.updated_at })
        .eq("key", row.key);
    for (const key of ["kitchen_default", "delivery_minutes"])
      if (!saved.some((r) => r.key === key))
        await db.from("settings").delete().eq("key", key);
    for (const u of users) await db.auth.admin.deleteUser(u.id);
    console.log("test rows, users and settings restored");
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
