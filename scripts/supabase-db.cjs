/**
 * Run a Supabase CLI command against the demo database without printing
 * the connection string, e.g. to apply and record a migration before merging:
 *
 *   node scripts/supabase-db.cjs migration list
 *   node scripts/supabase-db.cjs db push --dry-run
 *   node scripts/supabase-db.cjs db push --yes
 *
 * (Merging a migration to main also applies it via the GitHub integration;
 * pushing first just lets you test it. Already-recorded migrations are skipped.)
 */
const { spawnSync } = require("child_process");
const fs = require("fs");
const envFile = ".env.local";
const cwd = process.cwd();
const args = process.argv.slice(2);
const line = fs
  .readFileSync(envFile, "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("SUPABASE_DB_URL="));
const url = line
  ? line
      .slice("SUPABASE_DB_URL=".length)
      .trim()
      .replace(/^['"]|['"]$/g, "")
  : "";
if (!url) {
  console.log("SUPABASE_DB_URL missing");
  process.exit(1);
}
try {
  const u = new URL(url);
  console.log(
    `target host: ${u.hostname}:${u.port || 5432} user: ${decodeURIComponent(u.username)} password set: ${!!u.password}`,
  );
} catch {
  console.log("SUPABASE_DB_URL is not a valid URL");
  process.exit(1);
}
const r = spawnSync(
  "npx",
  ["--yes", "supabase@2.120.0", ...args, "--db-url", url],
  {
    cwd,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    ...(process.platform === "win32" ? { shell: true } : {}),
  },
);
const scrub = (s) =>
  (s || "")
    .split(url)
    .join("<db-url>")
    .replace(/postgres(ql)?:\/\/[^\s"']+/g, "<db-url>");
process.stdout.write(scrub(r.stdout));
process.stdout.write(scrub(r.stderr));
process.exit(r.status ?? 1);
