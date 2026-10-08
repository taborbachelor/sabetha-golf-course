/**
 * Run SQL against the demo database (SUPABASE_DB_URL in .env.local) and
 * print the rows. Never prints the connection string.
 *
 *   node scripts/db-query.cjs "select count(*) from public.orders"
 */
const { Client } = require("pg");
const fs = require("fs");
const envFile = ".env.local";
const sql = process.argv[2];
if (!sql) {
  console.error('Usage: node scripts/db-query.cjs "<sql>"');
  process.exit(1);
}
const line = fs
  .readFileSync(envFile, "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("SUPABASE_DB_URL="));
const c = new Client({
  connectionString: line
    .slice(16)
    .trim()
    .replace(/^['"]|['"]$/g, ""),
  ssl: { rejectUnauthorized: false },
});
(async () => {
  await c.connect();
  try {
    const r = await c.query(sql);
    for (const res of [].concat(r)) console.table(res.rows);
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
