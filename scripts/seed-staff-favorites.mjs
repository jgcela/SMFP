// Runs before each build (npm "prebuild"). Step 6c: the old Staff favorites page
// (content/staff-favorites/*.html) is imported once per school: one card per staff
// member, WITHOUT birthdays, the Allergies field or the health details listed in
// content/staff-favorites/redactions.json. The title, lead, notes and teams go to the
// school, and the old address is sent to /staff-favorites. Once the redirect exists
// the import never runs again, so staff edits (or deletions) are never undone.
// Never stops the build.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import postgres from "postgres";

const DIR = path.join(process.cwd(), "content/staff-favorites");
const unescape = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const text = (s) => unescape(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
// The old page's own clean-up of an answer, plus what removing a word can leave behind.
const clean = (v) => String(v).replace(/\s*,\s*,\s*/g, ", ").replace(/\s+,/g, ",").trim();
const tidy = (v) => clean(v.replace(/\s{2,}/g, " ")).replace(/^[,\s]+|[,\s]+$/g, "");

export function readStaffPage(file, redactions) {
  const src = readFileSync(file, "utf8");
  const grab = (name) => {
    const m = src.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\]);[ \\t]*(?:\\/\\/[^\\n]*)?\\n`));
    if (!m) throw new Error(`no ${name} list in the page`);
    return vm.runInNewContext(`(${m[1]})`, {}, { timeout: 1000 });
  };
  const FIELDS = grab("FIELDS"), TOP = grab("TOP"), MORE = grab("MORE"), TEAMS = grab("TEAMS"), STAFF = grab("STAFF"), WISHLISTS = grab("WISHLISTS");
  const never = new Set((redactions.never_import_fields ?? []).map((f) => FIELDS.indexOf(f)));
  if ([...never].some((i) => i < 0)) throw new Error("a field in never_import_fields is not on the page");
  const order = [...TOP, ...MORE].filter((k) => !never.has(k));
  const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const surname = (n) => norm(n.split(/[\s/]/).pop()).replace(/[^a-z-]/g, "");
  const wishlistHref = (src.match(/href="(teacher-wishlists[^"#]*)"/) ?? [])[1] ?? "";

  const cards = STAFF.map(([team, name, role, _birthday, f], i) => ({
    team, name, role, sort_order: i + 1,
    favorites: order.filter((k) => f[k] != null && f[k] !== "").map((k) => ({ label: FIELDS[k], value: clean(f[k]) })),
    wishlist_href: wishlistHref && WISHLISTS.includes(surname(name)) ? wishlistHref : "",
  }));
  for (const r of redactions.remove ?? []) {
    const hits = cards.filter((c) => c.name === r.name);
    let found = 0;
    for (const c of hits) for (const fav of c.favorites) {
      if (fav.label === r.field && fav.value.includes(r.text)) { fav.value = tidy(fav.value.replace(r.text, "")); found++; }
    }
    if (!found) throw new Error(`redaction not found: ${r.name} / ${r.field} / ${r.text}`);
  }
  for (const c of cards) c.favorites = c.favorites.filter((f) => f.value);

  const pick = (re) => src.match(re)?.[1] ?? "";
  return {
    title: text(pick(/<h1 id="page-title">([\s\S]*?)<\/h1>/)),
    lead: text(pick(/<p class="lead" id="page-lead">([\s\S]*?)<\/p>/)),
    notes: pick(/(<div class="notes">[\s\S]*?<\/div>)\s*<div class="toolbar">/),
    teams: TEAMS.map(([key, label]) => ({ key, label })),
    cards,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.PORTAL_DATABASE_URL;
  const school = process.env.PORTAL_SCHOOL;
  if (!url || !school) {
    console.log("seed-staff-favorites: no database configured, skipped");
    process.exit(0);
  }
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const [s] = await sql`select id from schools where slug = ${school}`;
    if (!s) throw new Error(`school ${school} not found`);
    const redactions = JSON.parse(readFileSync(path.join(DIR, "redactions.json"), "utf8"));
    for (const file of readdirSync(DIR).filter((f) => /\.html?$/i.test(f))) {
      const [done] = await sql`select 1 from redirects where school_id = ${s.id} and path = ${file}`;
      if (done) continue;
      const page = readStaffPage(path.join(DIR, file), redactions);
      await sql.begin(async (tx) => {
        for (const c of page.cards) {
          await tx`insert into staff_favorites ${tx({ ...c, favorites: tx.json(c.favorites), school_id: s.id, imported: true, updated_by: "Imported from the old page" })}`;
        }
        await tx`update schools set staff_title = ${page.title}, staff_lead = ${page.lead}, staff_intro_html = ${page.notes}, staff_teams = ${tx.json(page.teams)}
          where id = ${s.id} and staff_title = '' and staff_intro_html = ''`;
        await tx`insert into redirects (school_id, path, target) values (${s.id}, ${file}, 'staff-favorites')`;
        await tx`update links set href = 'staff-favorites' where school_id = ${s.id} and href = ${file}`;
      });
      console.log(`seed-staff-favorites: imported ${page.cards.length} staff cards from ${file}`);
    }
  } catch (e) {
    console.warn("seed-staff-favorites: skipped:", e instanceof Error ? e.message : e);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
