// Creates (or reuses) a staff user for a school and a one-time link to choose
// the password. The password itself never passes through anyone else.
//
//   node scripts/staff-link.mjs <school-slug> <email> "<name>" <portal-url> [--apply]
//
// Without --apply it prints the SQL to run in the "portal" database (Neon SQL
// editor) and the link. With --apply it runs the SQL using PORTAL_DATABASE_URL.
// The link works once and expires after 72 hours. Only its SHA-256 is stored.
import { createHash, randomBytes } from "node:crypto";

const [slug, emailRaw, name, base, flag] = process.argv.slice(2);
if (!slug || !emailRaw || !name || !base) {
  console.error('Usage: node scripts/staff-link.mjs <school-slug> <email> "<name>" <portal-url> [--apply]');
  process.exit(1);
}
const email = emailRaw.trim().toLowerCase();
const userId = randomBytes(16).toString("hex");
const token = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(token).digest("hex");
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;

const sql = `begin;
insert into auth_user (id, name, email, email_verified) values (${q(userId)}, ${q(name)}, ${q(email)}, true)
  on conflict (email) do nothing;
insert into school_staff (user_id, school_id)
  select u.id, s.id from auth_user u, schools s where u.email = ${q(email)} and s.slug = ${q(slug)}
  on conflict do nothing;
insert into staff_setup_links (token_hash, user_id, expires_at)
  select ${q(hash)}, u.id, now() + interval '72 hours' from auth_user u where u.email = ${q(email)};
commit;`;

const link = `${base.replace(/\/+$/, "")}/s/${slug}/admin/set-password?token=${token}`;

if (flag === "--apply") {
  const { default: postgres } = await import("postgres");
  const db = postgres(process.env.PORTAL_DATABASE_URL, { max: 1 });
  await db.unsafe(sql);
  await db.end();
  console.log("Done.");
} else {
  console.log(sql);
}
console.log(`\nOne-time link (72 hours):\n${link}`);
