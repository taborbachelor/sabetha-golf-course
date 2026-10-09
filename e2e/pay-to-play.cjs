/**
 * E2E: Pay to Play sandbox checkout, on an iPhone-sized phone.
 *
 *   node e2e/pay-to-play.cjs [baseUrl] [cardNumber]
 *
 * baseUrl defaults to http://localhost:3000 (run from the repo root).
 * Pass Square's decline card 4000000000000002 as cardNumber to test declines
 * (only the first checkout runs then).
 *
 * Covers: all errors at once with focus on the first, the cart price hint,
 * optional email, editing details after Continue keeps the typed card, a
 * dropped connection while paying (retry settles it, one charge), the
 * receipt, Back from the receipt, a fresh form when coming back to /pay, and
 * paying for a future date without an arrival time.
 *
 * Drives the installed Microsoft Edge with playwright-core against the DEMO
 * database from .env.local, and deletes the "Pay QA" rounds it made
 * afterwards. Square sandbox only. Screenshots go to e2e/.shots (gitignored).
 */
const fs = require("fs");
const { chromium, devices } = require("playwright-core");
const { createClient } = require("@supabase/supabase-js");

const base = process.argv[2] || "http://localhost:3000";
const cardNumber = process.argv[3] || "4111 1111 1111 1111";
const declineRun = cardNumber.replace(/\D/g, "") === "4000000000000002";
const shotDir = "e2e/.shots";
fs.mkdirSync(shotDir, { recursive: true });

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
const RUN = Date.now().toString(36);
const NAME = `Pay QA ${RUN}`;

function check(ok, message) {
  if (!ok) throw new Error(message);
  console.log("ok:", message);
}

async function cleanup() {
  const { data: rounds } = await db
    .from("rounds")
    .select("id")
    .like("name", `${NAME}%`);
  const ids = (rounds || []).map((r) => r.id);
  if (ids.length) {
    await db.from("cart_sessions").delete().in("round_id", ids);
    await db.from("rounds").delete().in("id", ids);
  }
  console.log("cleanup: deleted", ids.length, "test round(s)");
}

async function fillCard(p, number = cardNumber) {
  await p
    .locator("iframe.sq-card-component")
    .scrollIntoViewIfNeeded({ timeout: 30000 });
  const frame = p.frameLocator("iframe.sq-card-component");
  await frame.locator("#cardNumber").waitFor({ timeout: 60000 });
  await frame.locator("#cardNumber").fill(number);
  await frame.locator("#expirationDate").fill("12/30");
  await frame.locator("#cvv").fill("111");
  const zip = frame.locator("#postalCode");
  if (await zip.count()) await zip.fill("66534");
  return frame;
}

async function waitForReceiptOrAlert(p) {
  return Promise.race([
    p.waitForURL(/\/pay\/receipt\//, { timeout: 90000 }).then(() => "receipt"),
    p
      .locator("p[role=alert]:visible")
      .first()
      .waitFor({ timeout: 90000 })
      .then(() => "alert"),
  ]);
}

(async () => {
  const b = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const ctx = await b.newContext({
      ...devices["iPhone 13"],
      deviceScaleFactor: 2,
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    p.on("console", (m) => {
      if (m.type() === "error" && /hydrat/i.test(m.text())) errs.push(m.text());
    });

    // Come from the home page by a client-side link, so Back from the
    // receipt has somewhere to go and Next keeps /pay's state (Activity).
    await p.goto(`${base}/`, { waitUntil: "networkidle" });
    await p.locator('main a[href="/pay"]').first().click();
    await p.waitForURL(/\/pay$/);
    await p.getByRole("button", { name: "Continue to payment" }).waitFor();

    // --- All errors at once, focus on the first, cleared on change.
    await p.getByRole("button", { name: "Continue to payment" }).click();
    await p.getByText("Enter your name").waitFor();
    check(
      await p.getByText("Enter a 10-digit phone number").isVisible(),
      "name and phone errors shown together",
    );
    await p.waitForFunction(() => document.activeElement?.id === "pay-name");
    check(
      (await p.getByLabel("Name").getAttribute("aria-invalid")) === "true" &&
        (await p.getByLabel("Name").getAttribute("aria-describedby")) ===
          "pay-name-error",
      "first invalid field focused, with aria-invalid + aria-describedby",
    );
    await p.getByLabel("Name").fill(NAME);
    check(
      !(await p.getByText("Enter your name").isVisible()),
      "name error clears as soon as it's changed",
    );

    // --- Cart hint is the price for the chosen holes.
    check(
      await p.getByText("$15 each").isVisible(),
      "Carts hint shows $15 each for 9 holes",
    );
    await p.getByRole("button", { name: "18 holes", exact: true }).click();
    check(
      await p.getByText("$20 each").isVisible(),
      "Carts hint shows $20 each for 18 holes",
    );

    await p.getByRole("button", { name: "More players" }).click(); // 2 players
    await p.getByRole("button", { name: "More carts" }).click(); // 1 cart
    await p.getByRole("button", { name: "Now", exact: true }).click(); // any hour, never after midnight
    await p.getByLabel("Phone").fill("785-555-0100");
    check(
      (await p.getByLabel("Email (optional)").inputValue()) === "",
      "email is optional and left blank",
    );
    await p.waitForFunction(
      () =>
        /available/i.test(
          document.querySelector("#pay-carts-status")?.textContent || "",
        ),
      null,
      { timeout: 20000 },
    );
    await p.getByRole("button", { name: "Continue to payment" }).click();
    const frame = await fillCard(p);

    // --- Editing a field after Continue keeps the typed card.
    await p.getByLabel("Phone").fill("785-555-0199");
    await p.getByLabel("Phone").fill("785-555-0100");
    check(
      (await frame.locator("#cardNumber").inputValue()).replace(/\D/g, "") ===
        cardNumber.replace(/\D/g, ""),
      "card number survives editing details after Continue",
    );
    // Breaking a field blocks Pay with the error, and keeps the card too.
    await p.getByLabel("Name").fill("");
    await p.getByRole("button", { name: /^Pay \$/ }).click();
    await p.getByText("Enter your name").waitFor();
    check(
      (await frame.locator("#cardNumber").inputValue()) !== "",
      "invalid field on Pay shows the error and keeps the card",
    );
    await p.getByLabel("Name").fill(NAME);

    // --- Drop the connection on the first Pay (after the server got it).
    let dropped = 0;
    if (!declineRun) {
      await p.route(`${base}/pay`, async (route) => {
        const req = route.request();
        if (
          dropped === 0 &&
          req.method() === "POST" &&
          (req.postData() || "").includes("cnon:")
        ) {
          dropped++;
          await route.fetch(); // the server charges...
          return route.abort("internetdisconnected"); // ...the reply is lost
        }
        return route.fallback();
      });
    }

    const payBtn = p.getByRole("button", { name: /^Pay \$/ });
    console.log("pay button:", await payBtn.innerText());
    await payBtn.click();
    let outcome = await waitForReceiptOrAlert(p);

    if (!declineRun) {
      check(dropped === 1, "first Pay's reply was dropped");
      check(
        outcome === "alert" &&
          (
            await p.locator("p[role=alert]:visible").first().innerText()
          ).includes("Connection dropped. Tap Pay again"),
        "dropped connection shows the retry message",
      );
      check(
        await payBtn.isEnabled(),
        "form isn't frozen: Pay can be tapped again",
      );
      await p.screenshot({ path: `${shotDir}/pay-dropped.png` });
      await payBtn.click();
      outcome = await waitForReceiptOrAlert(p);
    }

    if (outcome !== "receipt") {
      const alert = await p
        .locator("p[role=alert]:visible")
        .first()
        .innerText();
      await p.screenshot({
        path: `${shotDir}/pay-to-play.png`,
        fullPage: true,
      });
      if (declineRun) {
        check(/declined/i.test(alert), `decline shown: ${alert}`);
        return;
      }
      throw new Error(`expected the receipt, got alert: ${alert}`);
    }
    if (declineRun) throw new Error("decline card reached a receipt");

    await p
      .getByText("Paid. You're all set.")
      .filter({ visible: true })
      .waitFor({ timeout: 20000 });
    const receiptId = p.url().split("/").pop();
    const receipt = await p.locator("main").innerText();
    console.log("receipt:", receipt.replace(/\n+/g, " | ").slice(0, 400));
    check(
      receipt.includes("Bookmark or screenshot this page. No email is sent.") &&
        receipt.includes("Demo: test payment"),
      "receipt has the bookmark line and the demo line",
    );
    await p.screenshot({ path: `${shotDir}/pay-to-play.png`, fullPage: true });

    const { data: rows } = await db
      .from("rounds")
      .select("id, status, email, payment_id, carts")
      .like("name", `${NAME}%`);
    check(
      rows.length === 1 &&
        rows[0].id === receiptId &&
        rows[0].status === "paid" &&
        rows[0].payment_id,
      "one paid round for the dropped + retried checkout",
    );
    check(rows[0].email === "", 'blank email stored as ""');

    // --- Back from the receipt skips the paid form; /pay is fresh again.
    await p.goBack({ waitUntil: "networkidle" });
    check(
      !/\/pay($|\?)/.test(new URL(p.url()).pathname),
      `Back from the receipt goes to the page before /pay (${new URL(p.url()).pathname})`,
    );
    // Client-side navigation back to /pay (the home page's Pay to Play link).
    await p.locator('main a[href="/pay"]').first().click();
    await p.waitForURL(/\/pay$/);
    await p.getByRole("button", { name: "Continue to payment" }).waitFor();
    check(
      (await p.getByLabel("Name").inputValue()) === "" &&
        !(await p.getByText("Paying…").isVisible()),
      "coming back to /pay shows a fresh, usable form",
    );

    // --- Future date, walking, no arrival time.
    const future = await p.evaluate(() => {
      const d = new Date(Date.now() + 3 * 864e5);
      return d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
    });
    await p.getByLabel("Date").fill(future);
    check(
      !(await p.getByRole("button", { name: "Pick a time" }).count()) &&
        (await p.getByLabel("Arrival time").isVisible()),
      "future date shows the time input directly, no lone chip",
    );
    check(
      await p.getByText("Optional", { exact: true }).isVisible(),
      "arrival time is optional when walking",
    );
    await p.getByLabel("Name").fill(`${NAME} Later`);
    await p.getByLabel("Phone").fill("785-555-0101");
    await p.getByLabel("Email (optional)").fill("payqa@example.com");
    await p.getByRole("button", { name: "Continue to payment" }).click();
    await fillCard(p);
    await p.getByRole("button", { name: /^Pay \$/ }).click();
    const futureOutcome = await waitForReceiptOrAlert(p);
    if (futureOutcome !== "receipt") {
      await p.screenshot({
        path: `${shotDir}/pay-to-play-future.png`,
        fullPage: true,
      });
    }
    check(
      futureOutcome === "receipt",
      `future-date walking round paid without a time${
        futureOutcome === "receipt"
          ? ""
          : ` (alert: ${await p.locator("p[role=alert]:visible").first().innerText()})`
      }`,
    );
    await p
      .getByText("Paid. You're all set.")
      .filter({ visible: true })
      .waitFor({ timeout: 20000 });
    check(
      (await p.locator("main").innerText()).includes("Any time"),
      'receipt says arriving "Any time"',
    );
    await p.screenshot({
      path: `${shotDir}/pay-to-play-future.png`,
      fullPage: true,
    });
    const { data: later } = await db
      .from("rounds")
      .select("arrival_time, arrive_at, play_date, email")
      .eq("name", `${NAME} Later`)
      .single();
    console.log("future round:", later);
    check(
      later.arrival_time === "Any time" && later.play_date === future,
      "stored with the Any time label",
    );

    // --- A checkout left pending past the hold window (server died
    // mid-payment): the receipt must not claim the card wasn't charged.
    const staleId = require("crypto").randomUUID();
    const staleCode = `R-Q${RUN.slice(-3).toUpperCase()}`;
    await db.from("rounds").insert({
      id: staleId,
      play_date: future,
      holes: 9,
      players: 1,
      carts: 0,
      name: `${NAME} Stale`,
      phone: "7855550100",
      email: "",
      amount_cents: 2000,
      status: "pending",
      code: staleCode,
      created_at: new Date(Date.now() - 15 * 60_000).toISOString(),
    });
    await p.goto(`${base}/pay/receipt/${staleId}`, {
      waitUntil: "networkidle",
    });
    const stale = await p.locator("main").innerText();
    check(
      stale.includes("If your card shows a charge, you're paid") &&
        stale.includes(staleCode) &&
        !/not charged|weren't charged/i.test(stale) &&
        (await p.locator('main a[href^="tel:"]').count()) === 1 &&
        (await p.locator('main a[href="/pay"]').innerText()) === "Pay again",
      "unfinished payment receipt: honest copy, code, tap-to-call, Pay again",
    );
    await p.screenshot({ path: `${shotDir}/pay-to-play-stale.png` });

    console.log("page errors:", errs.length ? errs : "none");
    if (errs.length) throw new Error("page errors");
  } finally {
    await b.close();
    await cleanup();
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
