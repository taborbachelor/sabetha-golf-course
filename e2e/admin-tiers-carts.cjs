/**
 * E2E: Admin membership types + carts: add a type -> on /memberships and /memberships/dues; edit dues; delete.
 * Add a cart; a cart in use can't be taken out of service; take one out and back.
 *
 *   node e2e/admin-tiers-carts.cjs [baseUrl]      (default http://localhost:3000; run from the repo root)
 *
 * Drives the installed Microsoft Edge with playwright-core. Uses the DEMO
 * database from .env.local: creates a temporary admin user, membership type,
 * cart and cart session and deletes them afterwards (the type through the
 * admin page, so the Memberships page cache refreshes).
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
const TIER = `E2E Senior ${Date.now() % 100000}`;

async function tierCard(page) {
  await page.goto(`${base}/memberships`);
  const li = page.locator("li", { hasText: TIER });
  return (await li.count())
    ? (await li.innerText()).replace(/\s+/g, " ").replace(TIER, "<type>")
    : "(not shown)";
}

(async () => {
  let adminId;
  let addedCart;
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
    await ap.goto(`${base}/admin/tiers`);
    await ap.getByLabel("Email").fill(created.user.email);
    await ap.getByLabel("Password").fill(password);
    await ap.getByRole("button", { name: "Sign in" }).click();
    await ap.waitForURL(/\/admin\/tiers$/, { timeout: 90000 });

    // 1. Membership types.
    await ap.getByText("Add a membership type").click({ timeout: 90000 });
    const add = ap
      .locator("details", { hasText: "Add a membership type" })
      .locator("form");
    await add.getByLabel("Name").fill(TIER);
    await add.getByLabel("Yearly dues").fill("lots");
    await add.getByRole("button", { name: "Add type" }).click();
    console.log("1 bad dues:", await add.getByRole("alert").innerText());
    await add.getByLabel("Yearly dues").fill("350");
    await add.getByLabel("Description (optional)").fill("Members 65 and over");
    await add.getByLabel("Sample").check();
    await add.getByRole("button", { name: "Add type" }).click();
    await ap
      .getByRole("status")
      .filter({ hasText: "Added" })
      .waitFor({ timeout: 30000 });

    const pub = await b.newPage({ viewport: { width: 390, height: 844 } });
    console.log("2 /memberships:", await tierCard(pub));
    await pub.goto(`${base}/memberships/dues`);
    await pub.getByRole("radio").first().waitFor({ timeout: 30000 });
    console.log(
      "3 /memberships/dues offers it:",
      (await pub.getByRole("radio", { name: new RegExp(TIER) }).count()) === 1,
    );

    const row = ap.locator("li", { hasText: TIER });
    await row.locator("summary").click();
    const edit = row.locator("form");
    await edit.getByLabel("Yearly dues").fill("375");
    await edit.getByRole("button", { name: "Save" }).click();
    await edit.getByRole("status").waitFor({ timeout: 30000 });
    console.log("4 /memberships after edit:", await tierCard(pub));

    // A type with an application can't be deleted.
    const { data: tier } = await db
      .from("membership_tiers")
      .select("id")
      .eq("name", TIER)
      .single();
    await db.from("membership_applications").insert({
      tier_id: tier.id,
      name: "E2E Applicant",
      address: "1 Test St",
      phone: "785-555-0100",
      email: "e2e-tier@example.com",
    });
    await edit.getByRole("button", { name: "Delete…" }).click();
    await edit.getByRole("button", { name: `Delete ${TIER}` }).click();
    console.log("5 in use:", await edit.getByRole("alert").innerText());
    await db
      .from("membership_applications")
      .delete()
      .eq("email", "e2e-tier@example.com");
    await edit.getByRole("button", { name: `Delete ${TIER}` }).click();
    await ap
      .locator("li", { hasText: TIER })
      .waitFor({ state: "detached", timeout: 30000 });
    console.log("6 deleted; /memberships:", await tierCard(pub));

    // 2. Carts.
    await ap.getByRole("link", { name: "Carts" }).click();
    await ap.waitForURL(/\/admin\/carts$/);
    const count = async () =>
      (
        await ap
          .locator("p", { hasText: /^\d+ carts? in service$/ })
          .innerText()
      ).replace(/\s+/g, " ");
    const before = await count();
    await ap.getByRole("button", { name: "Add a cart" }).click();
    const added = await ap
      .getByRole("status")
      .filter({ hasText: "Added cart" })
      .innerText({ timeout: 30000 });
    addedCart = Number(added.match(/\d+/)[0]);
    console.log("7 add:", before, "->", await count(), "|", added);

    const { data: cart } = await db
      .from("carts")
      .select("id")
      .eq("number", addedCart)
      .single();
    await db.from("cart_sessions").insert({
      cart_id: cart.id,
      name: "E2E Golfer",
      holes: 9,
      status: "out",
      source: "walkin",
    });
    await ap.reload();
    const card = ap.locator("li", { hasText: `Cart ${addedCart}` });
    await card.getByRole("button", { name: "Take out of service" }).click();
    console.log("8 in use:", await ap.locator("p[role=alert]").innerText());
    await db.from("cart_sessions").delete().eq("cart_id", cart.id);

    await card.getByRole("button", { name: "Take out of service" }).click();
    await card
      .getByRole("button", { name: "Put back in service" })
      .waitFor({ timeout: 30000 });
    await ap.screenshot({ path: `${shotDir}/admin-carts.png`, fullPage: true });
    console.log("9 retired:", await count());
    await card.getByRole("button", { name: "Put back in service" }).click();
    await card
      .getByRole("button", { name: "Take out of service" })
      .waitFor({ timeout: 30000 });
    console.log("10 restored:", await count());
  } catch (e) {
    for (const [i, pg] of b
      .contexts()
      .flatMap((c) => c.pages())
      .entries())
      await pg
        .screenshot({ path: `${shotDir}/admin-tiers-carts-fail-${i}.png` })
        .catch(() => {});
    throw e;
  } finally {
    await b.close();
    await db
      .from("membership_applications")
      .delete()
      .eq("email", "e2e-tier@example.com");
    const { data: left } = await db
      .from("membership_tiers")
      .delete()
      .eq("name", TIER)
      .select("id");
    if (left?.length)
      console.log(
        "WARNING: deleted the test type directly; /memberships may show it until the next save",
      );
    if (addedCart) {
      const { data: cart } = await db
        .from("carts")
        .select("id")
        .eq("number", addedCart)
        .maybeSingle();
      if (cart) {
        await db.from("cart_sessions").delete().eq("cart_id", cart.id);
        await db.from("carts").delete().eq("id", cart.id);
      }
    }
    if (adminId) await db.auth.admin.deleteUser(adminId);
    console.log("test rows and user deleted");
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
