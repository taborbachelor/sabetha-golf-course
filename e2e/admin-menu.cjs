/**
 * E2E: Admin menu: add an item -> on /menu at once; bad price rejected; change price; hide it; delete it.
 *
 *   node e2e/admin-menu.cjs [baseUrl]      (default http://localhost:3000; run from the repo root)
 *
 * Drives the installed Microsoft Edge with playwright-core. Uses the DEMO
 * database from .env.local: creates a temporary admin user and a test menu
 * item, and deletes both (the item through the admin page, so the public
 * menu cache refreshes). Screenshots go to e2e/.shots (gitignored).
 * Don't pipe this into `head`: that kills it before the cleanup runs.
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
const ITEM = `E2E Lemonade ${Date.now() % 100000}`;

/** The item's line on the public menu, or "(not shown)". */
async function onMenu(page) {
  await page.goto(`${base}/menu`);
  const li = page.locator("li", { hasText: ITEM });
  return (await li.count())
    ? (await li.innerText()).replace(/\s+/g, " ").replace(ITEM, "<item>")
    : "(not shown)";
}

(async () => {
  let adminId;
  const b = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const password = randomBytes(18).toString("base64url");
    const { data: created, error } = await db.auth.admin.createUser({
      email: `admin-test-${Date.now()}@example.com`,
      password,
      email_confirm: true,
      app_metadata: { role: "admin" },
    });
    if (error) throw error;
    adminId = created.user.id;

    const ap = await b.newPage({ viewport: { width: 1024, height: 900 } });
    await ap.goto(`${base}/admin/menu`);
    await ap.getByLabel("Email").fill(created.user.email);
    await ap.getByLabel("Password").fill(password);
    await ap.getByRole("button", { name: "Sign in" }).click();
    await ap.waitForURL(/\/admin\/menu$/, { timeout: 30000 });

    // 1. Add, with a bad price first.
    await ap.getByText("Add an item").click();
    const add = ap
      .locator("details", { hasText: "Add an item" })
      .locator("form");
    await add.getByLabel("Name").fill(ITEM);
    await add.getByLabel("Section").fill("Drinks");
    await add.getByLabel("Price").fill("two fifty");
    await add.getByLabel("Drink").check();
    await add.getByLabel("Sample").check();
    await add.getByRole("button", { name: "Add item" }).click();
    console.log("1 bad price:", await add.getByRole("alert").innerText());
    await add.getByLabel("Price").fill("2.50");
    await add.getByRole("button", { name: "Add item" }).click();
    await ap
      .getByRole("status")
      .filter({ hasText: "Added" })
      .waitFor({ timeout: 30000 });
    const { data: row } = await db
      .from("menu_items")
      .select("category, price_cents, is_food, is_sample, available")
      .eq("name", ITEM)
      .single();
    console.log("2 saved:", JSON.stringify(row));

    const pub = await b.newPage({ viewport: { width: 390, height: 844 } });
    console.log("3 /menu:", await onMenu(pub));

    // 2. Change the price, then hide it.
    const editRow = ap.locator("li", { hasText: ITEM });
    await editRow.locator("summary").click();
    const edit = editRow.locator("form");
    await edit.getByLabel("Price").fill("2.75");
    await edit.getByRole("button", { name: "Save" }).click();
    await edit.getByRole("status").waitFor({ timeout: 30000 });
    console.log("4 /menu after price change:", await onMenu(pub));

    await edit.getByLabel("On the menu").uncheck();
    await edit.getByRole("button", { name: "Save" }).click();
    await ap
      .locator("li", { hasText: ITEM })
      .getByText("Hidden")
      .waitFor({ timeout: 30000 });
    await ap.screenshot({ path: `${shotDir}/admin-menu.png`, fullPage: true });
    console.log("5 /menu after hiding:", await onMenu(pub));

    // 3. Delete it (two steps).
    await edit.getByRole("button", { name: "Delete…" }).click();
    await edit.getByRole("button", { name: `Delete ${ITEM}` }).click();
    await ap
      .locator("li", { hasText: ITEM })
      .waitFor({ state: "detached", timeout: 30000 });
    const { count } = await db
      .from("menu_items")
      .select("id", { count: "exact", head: true })
      .eq("name", ITEM);
    console.log("6 deleted, rows left:", count);
  } finally {
    await b.close();
    const { data: left } = await db
      .from("menu_items")
      .delete()
      .eq("name", ITEM)
      .select("id");
    if (left?.length)
      console.log(
        "WARNING: deleted the test item directly; /menu may show it until the next menu save",
      );
    if (adminId) await db.auth.admin.deleteUser(adminId);
    console.log("test user deleted");
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
