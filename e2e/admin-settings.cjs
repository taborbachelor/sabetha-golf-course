/**
 * E2E: Admin settings: change green fees + hours in /admin/settings -> /golf, /pay and /contact show them at once; bad input rejected; staff kept out; values restored.
 *
 *   node e2e/admin-settings.cjs [baseUrl]      (default http://localhost:3000; run from the repo root)
 *
 * Drives the installed Microsoft Edge with playwright-core. Uses the DEMO
 * database from .env.local: creates temporary staff/admin users and deletes
 * them afterwards. The edited settings are put back through the admin form
 * (so the site cache refreshes too). Screenshots go to e2e/.shots (gitignored).
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
const row = async (key) =>
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

async function signIn(page, user, next) {
  await page.goto(`${base}${next}`);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Text of the Weekday/Weekend row on /golf, e.g. "Weekday $20 $30". */
async function golfRow(page, label) {
  await page.goto(`${base}/golf`);
  return (
    await page.locator("tr", { hasText: label }).first().innerText()
  ).replace(/\s+/g, " ");
}

const isWeekendInKansas = () =>
  ["Sat", "Sun"].includes(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Chicago",
      weekday: "short",
    }).format(new Date()),
  );

(async () => {
  const users = [];
  const original = {
    green_fees: await row("green_fees"),
    clubhouse_hours: await row("clubhouse_hours"),
  };
  const was = original.green_fees;
  const want = { weekday: was.weekday["9"] + 1, weekend: was.weekend["9"] + 1 };
  const b = await chromium.launch({ channel: "msedge", headless: true });
  let restored = false;
  try {
    // 1. Staff can't open it.
    const staff = await makeUser("staff");
    users.push(staff);
    const sp = await b.newPage();
    await signIn(sp, staff, "/admin/settings");
    await sp.waitForURL(/\/staff$/, { timeout: 30000 });
    console.log("1 staff /admin/settings ->", new URL(sp.url()).pathname);

    // 2. Admin edits fees and Monday hours.
    const admin = await makeUser("admin");
    users.push(admin);
    const ap = await b.newPage({ viewport: { width: 1024, height: 900 } });
    await signIn(ap, admin, "/admin/settings");
    await ap.waitForURL(/\/admin\/settings$/, { timeout: 30000 });
    const save = async () => {
      await ap.getByRole("button", { name: "Save changes" }).click();
      await ap
        .getByRole("button", { name: "Saving…" })
        .waitFor({ timeout: 5000 })
        .catch(() => {});
      await ap
        .getByRole("button", { name: "Save changes" })
        .waitFor({ timeout: 30000 });
      return ap
        .locator("form p[role=status], form p[role=alert]")
        .first()
        .innerText()
        .catch(() => "(no message)");
    };

    await ap
      .getByRole("group", { name: "Cart rental" })
      .getByLabel("9 holes")
      .fill("15.5");
    console.log("2 cents rejected:", await save());
    console.log(
      "2 DB unchanged:",
      JSON.stringify(await row("green_fees")) === JSON.stringify(was),
    );
    await ap
      .getByRole("group", { name: "Cart rental" })
      .getByLabel("9 holes")
      .fill(String((await row("cart_rental"))["9"]));

    // Messages name the field and the rule, and the box gets focus.
    const tryBad = async (label, value, put) => {
      const input = ap.getByLabel(label);
      const was = await input.inputValue();
      await input.fill(value);
      const msg = await save();
      const focused = await ap.evaluate(
        () => document.activeElement?.getAttribute("name") ?? "",
      );
      await (put ?? input).fill(was);
      return `${msg} | focused ${focused}`;
    };
    console.log("2 negative:", await tryBad("Weekend 18", "-5"));
    console.log(
      "2 too many days:",
      await tryBad("Days ahead golfers can pay", "90"),
    );
    console.log(
      "2 short hold:",
      await tryBad("Cart held for 9 holes (min)", "20"),
    );
    const wed = ap.locator("div.group", { hasText: "Wednesday" });
    const wedClosed = await wed.getByLabel("Closed").isChecked();
    if (wedClosed) await wed.getByLabel("Closed").uncheck();
    console.log(
      "2 backwards hours:",
      await tryBad("Wednesday closes", "01:00"),
    );
    if (wedClosed) await wed.getByLabel("Closed").check();
    console.log(
      "2 unsaved edits warn on leave:",
      await ap.evaluate(() => {
        const e = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
      }),
    );

    await ap.getByLabel("Weekday 9").fill(String(want.weekday));
    await ap.getByLabel("Weekend 9").fill(String(want.weekend));
    const monday = ap.locator("div.group", { hasText: "Monday" });
    await monday.getByLabel("Closed").uncheck();
    await ap.getByLabel("Monday opens").fill("12:00");
    await ap.getByLabel("Monday closes").fill("18:00");
    console.log("3 save:", await save());
    console.log(
      "3 warns on leave after saving:",
      await ap.evaluate(() => {
        const e = new Event("beforeunload", { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
      }),
    );
    await ap.screenshot({
      path: `${shotDir}/admin-settings.png`,
      fullPage: true,
    });

    // 3. The public site shows it straight away.
    const pub = await b.newPage({ viewport: { width: 390, height: 844 } });
    console.log(
      "4 /golf:",
      await golfRow(pub, "Weekday"),
      "|",
      await golfRow(pub, "Weekend"),
    );
    await pub.goto(`${base}/contact`);
    console.log(
      "5 /contact Monday:",
      (
        await pub
          .locator("li, tr, div", { hasText: /^Mon/ })
          .first()
          .innerText()
          .catch(() => "?")
      ).replace(/\s+/g, " "),
    );
    await pub.goto(`${base}/pay`);
    const total = (await pub.getByLabel("Total").innerText()).replace(
      /\s+/g,
      " ",
    );
    const expected = isWeekendInKansas() ? want.weekend : want.weekday;
    console.log(
      "6 /pay total:",
      total,
      "| expects",
      `$${expected}.00:`,
      total.includes(`$${expected}.00`),
    );

    // 4. Put everything back through the form.
    await ap.getByLabel("Weekday 9").fill(String(was.weekday["9"]));
    await ap.getByLabel("Weekend 9").fill(String(was.weekend["9"]));
    await monday.getByLabel("Closed").check();
    console.log("7 restore:", await save());
    restored =
      JSON.stringify(await row("green_fees")) === JSON.stringify(was) &&
      JSON.stringify(await row("clubhouse_hours")) ===
        JSON.stringify(original.clubhouse_hours);
    console.log("7 restored in DB:", restored);
    console.log("8 /golf after restore:", await golfRow(pub, "Weekday"));
  } finally {
    await b.close();
    if (!restored) {
      for (const [key, value] of Object.entries(original))
        await db.from("settings").update({ value }).eq("key", key);
      console.log(
        "WARNING: restored settings directly in the DB; the site cache may show test values until an admin saves",
      );
    }
    for (const u of users) await db.auth.admin.deleteUser(u.id);
    console.log("test users deleted");
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
