/**
 * Give a Supabase user staff or admin access (or remove it).
 *
 *   node --no-warnings scripts/set-staff-role.mts <email> <staff|admin|none>
 *
 * Create the user first in the Supabase dashboard (Authentication > Users >
 * Add user). The role goes in app_metadata, which users can't change
 * themselves and which RLS checks. Reads .env.local; never prints secrets.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [email, role] = process.argv.slice(2);
if (!email || !["staff", "admin", "none"].includes(role)) {
  console.error(
    "Usage: node scripts/set-staff-role.mts <email> <staff|admin|none>",
  );
  process.exit(1);
}

const env: Record<string, string> = {};
for (const line of readFileSync(".env.local", "utf8")
  .replace(new RegExp(`^${String.fromCharCode(0xfeff)}`), "") // strip a BOM
  .split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, "");
}

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

let user = null;
for (let page = 1; !user; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  user =
    data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ??
    null;
  if (data.users.length < 200) break;
}
if (!user) {
  console.error(
    `No user with email ${email}. Add them in Supabase > Authentication > Users first.`,
  );
  process.exit(1);
}

const { error } = await db.auth.admin.updateUserById(user.id, {
  app_metadata: { ...user.app_metadata, role: role === "none" ? null : role },
});
if (error) throw error;
console.log(`${email}: role = ${role}`);
