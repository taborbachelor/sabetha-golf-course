/**
 * E2E: Staff tablet robustness: today-only / paid-only Needs a cart, "cart 1 of 2",
 * held-for-online count, overnight cart, late order, sound bar, double tap,
 * Undo (delivered + returned), stale cart pick, walk-in name, offline bar +
 * failed save, sign-out confirm, expired session -> sign in.
 *
 *   node e2e/staff-tablet.cjs [baseUrl]      (default http://localhost:3000; run from the repo root)
 *
 * Drives the installed Microsoft Edge with playwright-core. Uses the DEMO
 * database from .env.local: seeds rows named "Tablet QA ..." directly (no
 * payments) and deletes them and the temporary staff user afterwards. Online
 * reservations are seeded for 11:15pm so they do not take carts from anyone
 * paying for "now"; the overnight walk-in holds one free cart for the run.
 * Screenshots go to e2e/.shots (gitignored).
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const { randomBytes, randomUUID } = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const base = process.argv[2] || "http://localhost:3000";
const shot = "e2e/.shots";
fs.mkdirSync(shot, { recursive: true });
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
const TZ = "America/Chicago";
const dayIn = (d) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
const today = dayIn(new Date());
const yesterday = dayIn(new Date(Date.now() - 86400000));
// Late tonight club time (UTC-5 = CDT; 10:15pm under CST, still today):
// outside everybody's "now" window.
const lateTonight = new Date(`${today}T23:15:00-05:00`).toISOString();
const yesterdayAfternoon = new Date(
  `${yesterday}T16:23:00-05:00`,
).toISOString();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const expect = (ok, what) => {
  if (!ok) throw new Error(`expected ${what}`);
};
const tag = randomBytes(3).toString("hex");
const P = "Tablet QA";

async function main() {
  const email = `tablet-qa-${Date.now()}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const { data: u, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "staff" },
  });
  if (error) throw error;
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const errs = [];
  try {
    // ---- seed ----
    const party = randomUUID(),
      unpaid = randomUUID(),
      noshow = randomUUID();
    const round = (id, name, status, play_date, carts, arrive) => ({
      id,
      play_date,
      holes: 18,
      players: 4,
      name,
      phone: "785-555-0100",
      email: "qa@example.com",
      amount_cents: 1000,
      status,
      carts,
      arrive_at: arrive,
      arrival_time: "later",
      code: `RQ${tag}${id.slice(0, 3)}`.toUpperCase(),
    });
    let r = await db
      .from("rounds")
      .insert([
        round(party, `${P} Party`, "paid", today, 2, lateTonight),
        round(unpaid, `${P} Unpaid`, "pending", today, 1, lateTonight),
        round(noshow, `${P} Noshow`, "paid", yesterday, 1, yesterdayAfternoon),
      ]);
    if (r.error) throw r.error;
    const sess = (round_id, name, reserved_for) => ({
      round_id,
      name,
      holes: 18,
      status: "reserved",
      reserved_for,
      source: "online",
    });
    r = await db
      .from("cart_sessions")
      .insert([
        sess(party, `${P} Party`, lateTonight),
        sess(party, `${P} Party`, lateTonight),
        sess(unpaid, `${P} Unpaid`, lateTonight),
        sess(noshow, `${P} Noshow`, yesterdayAfternoon),
      ]);
    if (r.error) throw r.error;
    const { data: carts } = await db
      .from("carts")
      .select("id, number")
      .eq("active", true)
      .order("number");
    const { data: busy } = await db
      .from("cart_sessions")
      .select("cart_id")
      .in("status", ["reserved", "ready", "out"]);
    const freeCarts = carts.filter(
      (c) => !busy.some((b) => b.cart_id === c.id),
    );
    const overnightCart = freeCarts[freeCarts.length - 1];
    r = await db.from("cart_sessions").insert({
      cart_id: overnightCart.id,
      name: `${P} Overnight`,
      holes: 9,
      status: "out",
      reserved_for: yesterdayAfternoon,
      out_at: yesterdayAfternoon,
      source: "walkin",
    });
    if (r.error) throw r.error;
    const orderId = randomUUID();
    r = await db.from("orders").insert({
      id: orderId,
      hole: 5,
      name: `${P} Order`,
      phone: "785-555-0100",
      items: [
        { id: "a", name: "Cheeseburger", qty: 2, is_alcohol: false },
        { id: "b", name: "Domestic beer (can)", qty: 3, is_alcohol: true },
      ],
      total_cents: 2000,
      has_alcohol: true,
      status: "new",
      code: `OQ${tag}`.toUpperCase(),
      created_at: new Date(Date.now() - 12 * 60000).toISOString(),
    });
    if (r.error) throw r.error;
    console.log("seeded; overnight cart #" + overnightCart.number);

    // ---- sign in ----
    const ctx = await browser.newContext({
      viewport: { width: 1180, height: 820 },
    });
    const tab = await ctx.newPage();
    tab.on("pageerror", (e) => errs.push(e.message));
    await tab.goto(`${base}/staff`);
    await tab.getByLabel("Email").fill(email);
    await tab.getByLabel("Password").fill(password);
    await tab.getByRole("button", { name: "Sign in" }).click();
    await tab
      .getByRole("heading", { name: "Clubhouse" })
      .waitFor({ timeout: 60000 });
    await tab.getByText("Live", { exact: true }).waitFor({ timeout: 30000 });
    console.log("1 signed in, Live");

    const status = async (table, id) =>
      (await db.from(table).select("status").eq("id", id).single()).data.status;

    // #8 #43 #44: today's paid reservations only, multi-cart party numbered.
    const needs = tab.locator("section[aria-labelledby=needs-heading]");
    await needs.getByText(`${P} Party`).first().waitFor();
    const rows = (await needs.locator("li").allInnerTexts()).map(
      (t) => t.split("\n")[0],
    );
    console.log("2 needs a cart:", JSON.stringify(rows));
    expect(
      rows.includes(`${P} Party · cart 1 of 2`) &&
        rows.includes(`${P} Party · cart 2 of 2`),
      "party numbered cart 1 of 2 / 2 of 2",
    );
    expect(
      (await needs.getByText(`${P} Unpaid`).count()) === 0 &&
        (await needs.getByText(`${P} Noshow`).count()) === 0,
      "no unpaid round and no yesterday no-show in Needs a cart",
    );
    // #4
    const summary = await tab.locator("#carts-heading span").innerText();
    console.log("3 carts heading:", summary);
    expect(
      /^\d+ free( · \d+ held for online)?$/.test(summary),
      "N free · M held",
    );
    // #8 overnight cart
    const overnight = tab.locator("section[aria-labelledby=carts-heading] li", {
      hasText: `${P} Overnight`,
    });
    const tileText = (await overnight.innerText()).replace(/\n+/g, " | ");
    console.log("4 overnight tile:", tileText);
    expect(/since \w{3} \d/.test(tileText), "overnight cart shows the day");
    expect(
      /border-red-600/.test(await overnight.getAttribute("class")),
      "overnight cart has a red border",
    );
    // #41
    const orderCard = tab
      .locator("section[aria-labelledby=orders-heading] li", {
        hasText: `${P} Order`,
      })
      .first();
    const lateWait = orderCard.locator("p.text-red-700");
    expect((await lateWait.count()) === 1, "12-minute-old order wait in red");
    console.log("5 late order wait in red:", await lateWait.innerText());
    await tab.screenshot({ path: `${shot}/tablet-landscape.png` });
    await tab.setViewportSize({ width: 820, height: 1180 });
    await sleep(500);
    await tab.screenshot({ path: `${shot}/tablet-portrait.png` });
    await tab.setViewportSize({ width: 1180, height: 820 });

    // #9 sound bar turns sound on
    await tab.getByRole("button", { name: /Sound is OFF/ }).click();
    await tab.getByRole("button", { name: "Sound on" }).waitFor();
    expect(
      (await tab.getByRole("button", { name: /Sound is OFF/ }).count()) === 0,
      "sound bar gone after tap",
    );
    console.log("6 sound bar tapped -> Sound on");

    // #5 a burst of taps on Start must stop at Preparing
    const start = orderCard.getByRole("button", { name: "Start" });
    const box = await start.boundingBox();
    for (let i = 0; i < 12; i++) {
      await tab.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await sleep(100);
    }
    await sleep(1500);
    const afterBurst = await status("orders", orderId);
    console.log("7 12 taps on Start in 1.2s -> DB:", afterBurst);
    expect(afterBurst === "preparing", "burst of taps stops at preparing");

    // #50 Delivered -> Undo
    await orderCard.getByRole("button", { name: "Send out" }).click();
    const delivered = orderCard.getByRole("button", {
      name: "Delivered",
      exact: true,
    });
    await delivered.waitFor({ timeout: 15000 });
    await sleep(1200);
    await delivered.click();
    const undoToast = tab.getByRole("status").filter({ hasText: "delivered" });
    await undoToast.waitFor({ timeout: 15000 });
    console.log(
      "8 toast:",
      (await undoToast.innerText()).replace(/\n/g, " | "),
    );
    await orderCard.waitFor({ state: "detached", timeout: 15000 });
    await undoToast.getByRole("button", { name: "Undo" }).click();
    await delivered.waitFor({ timeout: 15000 });
    expect(
      (await status("orders", orderId)) === "out_for_delivery",
      "undo delivered -> out_for_delivery",
    );
    console.log("  Undo -> back to On the way");

    // #50 Returned -> Undo
    await overnight.getByRole("button", { name: "Returned" }).click();
    const cartUndo = tab.getByRole("status").filter({ hasText: "returned" });
    await cartUndo.waitFor({ timeout: 15000 });
    console.log("9 toast:", (await cartUndo.innerText()).replace(/\n/g, " | "));
    await overnight.waitFor({ state: "detached", timeout: 15000 });
    await cartUndo.getByRole("button", { name: "Undo" }).click();
    await overnight.getByRole("button", { name: "Returned" }).waitFor({
      timeout: 15000,
    });
    const back = (
      await db
        .from("cart_sessions")
        .select("status, returned_at")
        .eq("name", `${P} Overnight`)
        .single()
    ).data;
    expect(back.status === "out" && back.returned_at === null, "undo returned");
    console.log("  Undo -> cart out again");
    await sleep(11000);
    expect(
      (await tab
        .getByRole("status")
        .filter({ hasText: "returned" })
        .count()) === 0,
      "undo toast gone after ~10 s",
    );

    // #44 the picked cart is taken on another screen -> falls back
    const select = needs
      .locator("li", { hasText: `${P} Party` })
      .first()
      .locator("select");
    const opts = await select.locator("option").allInnerTexts();
    const pickLabel = opts[opts.length - 1];
    await select.selectOption({ label: pickLabel });
    const pickedId = await select.inputValue();
    await db.from("cart_sessions").insert({
      cart_id: pickedId,
      name: `${P} Taker`,
      holes: 9,
      status: "out",
      reserved_for: new Date().toISOString(),
      out_at: new Date().toISOString(),
      source: "walkin",
    });
    await tab
      .locator("section[aria-labelledby=carts-heading] li", {
        hasText: `${P} Taker`,
      })
      .waitFor({ timeout: 15000 });
    const nowPicked = await select.locator("option:checked").innerText();
    console.log(
      `10 picked ${pickLabel}, it was taken -> select shows ${nowPicked}`,
    );
    expect(nowPicked !== pickLabel, "stale cart choice falls back");
    await db.from("cart_sessions").delete().eq("name", `${P} Taker`);

    // #44 walk-in name required; #4 heads-up. Fake waiting reservations are
    // injected into this browser's own reads only (nothing in the database).
    const fakeRound = randomUUID();
    await tab.route("**/rest/v1/rounds?*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const res = await route.fetch();
      const body = await res.json();
      body.push({
        ...round(
          fakeRound,
          `${P} Fake`,
          "paid",
          today,
          4,
          new Date().toISOString(),
        ),
        created_at: new Date().toISOString(),
      });
      await route.fulfill({ response: res, json: body });
    });
    await tab.route("**/rest/v1/cart_sessions?*", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      const res = await route.fetch();
      const body = await res.json();
      for (let i = 0; i < 10; i++) {
        body.push({
          id: randomUUID(),
          cart_id: null,
          round_id: fakeRound,
          name: `${P} Fake`,
          holes: 18,
          status: "reserved",
          reserved_for: new Date().toISOString(),
          out_at: null,
          source: "online",
        });
      }
      await route.fulfill({ response: res, json: body });
    });
    await tab.evaluate(() => window.dispatchEvent(new Event("online")));
    await needs.getByText(`${P} Fake`).first().waitFor({ timeout: 15000 });
    await tab.getByRole("button", { name: "Rent cart (walk-in)" }).click();
    const form = tab.getByRole("form", { name: "Rent a cart to a walk-in" });
    await form.getByRole("button", { name: "Cart is out" }).click();
    const nameError = await form.getByRole("alert").innerText();
    console.log("11 walk-in with no name ->", nameError);
    expect(/name/i.test(nameError), "name required");
    const note = await form.getByRole("note").innerText();
    console.log("  heads-up:", note);
    expect(/Heads-up/.test(note), "heads-up when free carts <= held");
    await tab.screenshot({ path: `${shot}/tablet-walkin-headsup.png` });
    await form.getByRole("button", { name: "Cancel" }).click();
    await tab.unrouteAll({ behavior: "wait" });
    await tab.evaluate(() => window.dispatchEvent(new Event("online")));
    await needs.getByText(`${P} Fake`).first().waitFor({ state: "detached" });

    // #3 #2 offline: bar shows; a tap fails loudly and the button comes back
    await ctx.setOffline(true);
    await tab
      .getByText("Not updating. Check Wi-Fi.")
      .waitFor({ timeout: 10000 });
    console.log("12 offline -> 'Not updating' bar");
    const returned = overnight.getByRole("button", { name: "Returned" });
    await returned.click();
    const failed = tab
      .locator("[role=alert]")
      .filter({ hasText: "Couldn't save" });
    await failed.waitFor({ timeout: 20000 });
    expect(await returned.isEnabled(), "button enabled again after failure");
    console.log("  tap while offline -> 'Couldn't save…', button usable again");
    await ctx.setOffline(false);
    await tab.getByText("Live", { exact: true }).waitFor({ timeout: 30000 });
    expect(
      (await tab.getByText("Not updating. Check Wi-Fi.").count()) === 0,
      "bar gone once back online",
    );
    console.log("  back online -> Live, bar gone");
    await sleep(8500);
    expect((await failed.count()) === 0, "message clears after ~8 s");
    expect(
      (await status(
        "cart_sessions",
        (
          await db
            .from("cart_sessions")
            .select("id")
            .eq("name", `${P} Overnight`)
            .single()
        ).data.id,
      )) === "out",
      "offline tap changed nothing",
    );

    // #42 sign out asks first
    await tab.getByRole("button", { name: "Sign out" }).click();
    const confirm = tab.getByRole("group", { name: "Confirm sign out" });
    console.log(
      "13 sign out ->",
      (await confirm.innerText()).replace(/\n/g, " | "),
    );
    await confirm.getByRole("button", { name: "Cancel" }).click();
    expect(
      (await tab.getByRole("button", { name: "Sign out" }).count()) === 1,
      "cancel keeps the tablet signed in",
    );

    // #2 expired session: next tap goes to sign in
    await ctx.clearCookies();
    await overnight.getByRole("button", { name: "Returned" }).click();
    await tab.waitForURL(
      /\/staff\/login\?next=%2Fstaff|\/staff\/login\?next=\/staff/,
      {
        timeout: 30000,
      },
    );
    console.log("14 cookies cleared + tap ->", new URL(tab.url()).pathname);
    expect(errs.length === 0, `no page errors (${errs.join("; ")})`);
    console.log("page errors: none");
  } finally {
    await browser.close();
    await db.from("cart_sessions").delete().like("name", `${P}%`);
    await db.from("rounds").delete().like("name", `${P}%`);
    await db.from("orders").delete().like("name", `${P}%`);
    await db.auth.admin.deleteUser(u.user.id);
    console.log("cleanup done");
  }
}
main().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
