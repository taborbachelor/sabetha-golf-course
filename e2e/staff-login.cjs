/**
 * E2E: Staff login: redirects, wrong password, no-role account, role grant, sign out, open-redirect guard.
 *
 *   node e2e/staff-login.cjs [baseUrl]      (default http://localhost:3000; run from the repo root)
 *
 * Drives the installed Microsoft Edge with playwright-core. Uses the DEMO
 * database from .env.local: creates temporary users/rows and deletes them
 * afterwards, and resets kitchen_status / ignore_hours_for_demo. Square sandbox only.
 * Screenshots go to e2e/.shots (gitignored).
 */
const { chromium } = require("playwright-core");
const fs = require("fs");
const { randomBytes } = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { execSync } = require("child_process");
const base = process.argv[2] || "http://localhost:3000";
const envFile = ".env.local";
const shotDir = "e2e/.shots";
const repo = process.cwd();
require("fs").mkdirSync(shotDir, { recursive: true });
const env = {};
for (const l of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const email = `staff-test-${Date.now()}@example.com`,
  password = randomBytes(18).toString("base64url");
(async () => {
  const { data: created, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  let p;
  const submit = async () => {
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.waitForFunction(
      () => !document.querySelector("button[type=submit]")?.disabled,
      null,
      { timeout: 20000 },
    );
  };
  const b = await chromium.launch({ channel: "msedge", headless: true });
  p = await b.newPage();
  try {
    await p.goto(`${base}/staff`);
    console.log(
      "1 signed-out /staff ->",
      new URL(p.url()).pathname + new URL(p.url()).search,
    );
    await p.getByLabel("Email").fill(email);
    await p.getByLabel("Password").fill("wrong-password");
    await submit();
    console.log(
      "2 email kept:",
      (await p.getByLabel("Email").inputValue()) === email,
    );
    console.log(
      "2 wrong password:",
      await p.locator("p[role=alert]").innerText(),
    );
    await p.getByLabel("Password").fill(password);
    await submit();
    console.log("3 no role:", await p.locator("p[role=alert]").innerText());
    console.log(
      "4 grant:",
      execSync(`node --no-warnings scripts/set-staff-role.mts ${email} staff`, {
        cwd: repo,
        encoding: "utf8",
      }).trim(),
    );
    await p.getByLabel("Password").fill(password);
    await p.getByRole("button", { name: "Sign in" }).click();
    await p.waitForURL(/\/staff$/, { timeout: 20000 });
    await p.getByRole("heading", { name: "Clubhouse" }).waitFor();
    console.log(
      "5 signed in:",
      new URL(p.url()).pathname,
      "|",
      (await p.getByText(email).count()) === 1
        ? "<test user> shown"
        : "email missing",
    );
    // Sign out asks first (inline, not a browser dialog).
    await p.getByRole("button", { name: "Sign out" }).click();
    await p
      .getByRole("group", { name: "Confirm sign out" })
      .getByRole("button", { name: "Yes, sign out" })
      .click();
    await p.waitForURL(/\/staff\/login/);
    await p.goto(`${base}/staff`);
    console.log("6 after sign out /staff ->", new URL(p.url()).pathname);
    await p.goto(`${base}/staff/login?next=https://evil.example.com`);
    console.log(
      "7 hidden next for external URL:",
      await p.locator("input[name=next]").inputValue(),
    );
  } finally {
    await b.close();
    await db.auth.admin.deleteUser(created.user.id);
    console.log("test user deleted");
  }
})().catch((e) => {
  console.error("FAILED:", e.message.split("\n")[0]);
  process.exit(1);
});
