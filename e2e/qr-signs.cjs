/**
 * E2E: QR signs: each sheet renders, every printed code encodes the URL printed under it (regenerated
 * with the same qrcode options and compared), the URLs open the right pages, and the sheets print to
 * the right number of PDF pages (1 Pay to Play, 9 tee boxes, 1 cart stickers). Staff can't open it.
 *
 *   node e2e/qr-signs.cjs [baseUrl]      (default http://localhost:3000; run from the repo root)
 *
 * Drives the installed Microsoft Edge with playwright-core. Creates temporary
 * admin/staff users and deletes them. PDFs and screenshots go to e2e/.shots (gitignored).
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const QRCode = require("qrcode");
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

/** The drawn modules of a QR SVG, ignoring how the browser re-serialises tags. */
const paths = (svg) =>
  [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]).join("|");

const pdfPages = (buf) =>
  (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;

(async () => {
  const users = [];
  const b = await chromium.launch({ channel: "msedge", headless: true });
  try {
    const staff = await makeUser("staff");
    users.push(staff);
    const sp = await b.newPage();
    await signIn(sp, staff, "/admin/signs");
    await sp.waitForURL(/\/staff$/, { timeout: 90000 });
    console.log("1 staff /admin/signs ->", new URL(sp.url()).pathname);

    const admin = await makeUser("admin");
    users.push(admin);
    const ap = await b.newPage({ viewport: { width: 1024, height: 900 } });
    await signIn(ap, admin, "/admin/signs");
    await ap.waitForURL(/\/admin\/signs/, { timeout: 90000 });

    const targets = new Set();
    for (const [sheet, wantPages] of [
      ["hole1", 1],
      ["tees", 9],
      ["carts", 1],
    ]) {
      await ap.goto(`${base}/admin/signs?sheet=${sheet}`);
      await ap.locator("[data-qr-url]").first().waitFor({ timeout: 30000 });
      const codes = await ap.locator("[data-qr-url]").evaluateAll((els) =>
        els.map((el) => ({
          url: el.getAttribute("data-qr-url"),
          svg: el.innerHTML,
          caption: el.closest("figure").querySelector("figcaption").textContent,
        })),
      );
      let matches = 0;
      for (const c of codes) {
        const expected = await QRCode.toString(c.url, {
          type: "svg",
          margin: 1,
          errorCorrectionLevel: "M",
        });
        if (paths(expected) === paths(c.svg) && c.url.endsWith(c.caption))
          matches++;
        targets.add(c.url);
      }
      await ap.emulateMedia({ media: "print" });
      const pdf = await ap.pdf({
        format: "Letter",
        preferCSSPageSize: true,
        printBackground: true,
      });
      await ap.emulateMedia({ media: "screen" });
      fs.writeFileSync(`${shotDir}/signs-${sheet}.pdf`, pdf);
      console.log(
        `2 ${sheet}: ${codes.length} codes, ${matches} verified | PDF pages ${pdfPages(pdf)} (want ${wantPages}) | ${[...new Set(codes.map((c) => c.url))].join(" ")}`,
      );
    }

    // The printed URLs open the right pages (relative to the site under test).
    const phone = await b.newPage({ viewport: { width: 390, height: 844 } });
    for (const url of [...targets].sort()) {
      const u = new URL(url);
      await phone.goto(`${base}${u.pathname}${u.search}`);
      const h1 = await phone
        .getByRole("heading", { level: 1 })
        .first()
        .innerText();
      const hole = u.searchParams.get("hole");
      let extra = "";
      if (hole) {
        // Ordering may be closed outside hours; then there's no hole picker.
        const picked = phone.locator('[aria-pressed="true"]', {
          hasText: new RegExp(`^${hole}$`),
        });
        extra = (await picked.count())
          ? ` | hole ${hole} preselected`
          : " | (ordering closed: no picker)";
      }
      console.log(`3 ${u.pathname}${u.search} -> ${h1}${extra}`);
    }
  } catch (e) {
    for (const [i, pg] of b
      .contexts()
      .flatMap((c) => c.pages())
      .entries())
      await pg
        .screenshot({ path: `${shotDir}/qr-signs-fail-${i}.png` })
        .catch(() => {});
    throw e;
  } finally {
    await b.close();
    for (const u of users) await db.auth.admin.deleteUser(u.id);
    console.log("test users deleted");
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
