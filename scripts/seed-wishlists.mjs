// Runs before each build (npm "prebuild"), after the Staff favorites import. Step 6d:
// the old Teacher wishlists page (content/wishlists/*.html) is imported once per
// school: one list per teacher, joined to their Staff favorites card (by surname,
// see content/wishlists/links.json) so the name is written once. The title, lead,
// notes and groups go to the school, and the old address is sent to /wishlists.
// Once the redirect exists the import never runs again. Never stops the build.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import postgres from "postgres";

const DIR = path.join(process.cwd(), "content/wishlists");
const unescape = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const text = (s) => unescape(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
export const norm = (s) => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export const surname = (n) => norm(String(n).split(/[\s/]/).pop()).replace(/[^a-z-]/g, "");

export function readWishlistPage(file, rules) {
  const src = readFileSync(file, "utf8");
  const grab = (re, what) => {
    const m = src.match(re);
    if (!m) throw new Error(`no ${what} in the page`);
    return vm.runInNewContext(`(${m[1]})`, {}, { timeout: 1000 });
  };
  const LISTS = grab(/const LISTS = (\[[\s\S]*?\n\]);/, "LISTS");
  const GROUPS = grab(/const GROUPS = (\[[\s\S]*?\]\]);/, "GROUPS");
  const strip = rules.strip_query_from ?? [];
  const clean = (u) => {
    try {
      const url = new URL(u);
      if (strip.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) url.search = "";
      return url.toString();
    } catch { return u; }
  };
  const pick = (re) => src.match(re)?.[1] ?? "";
  return {
    title: text(pick(/<h1 id="page-title">([\s\S]*?)<\/h1>/)),
    lead: text(pick(/<p class="lead" id="page-lead">([\s\S]*?)<\/p>/)),
    notes: pick(/(<div class="notes">[\s\S]*?<\/div>)\s*<div class="toolbar">/),
    groups: GROUPS.map(([key, label]) => ({ key, label })),
    lists: LISTS.map(([grp, name, class_text, href], i) => ({ grp, name, class_text, store_url: clean(href), sort_order: i + 1 })),
  };
}

/** The Staff favorites card of a list: same surname; `pick` settles a surname with several cards. */
export function matchCard(name, cards, rules) {
  const s = surname(name);
  const same = cards.filter((c) => surname(c.name) === s);
  if (same.length <= 1) return same[0] ?? null;
  const word = rules.pick?.[s];
  const chosen = word ? same.filter((c) => c.role.includes(word)) : [];
  if (chosen.length !== 1) throw new Error(`${name}: ${same.length} Staff favorites cards and no single pick in links.json`);
  return chosen[0];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.PORTAL_DATABASE_URL;
  const school = process.env.PORTAL_SCHOOL;
  if (!url || !school) {
    console.log("seed-wishlists: no database configured, skipped");
    process.exit(0);
  }
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const [s] = await sql`select id from schools where slug = ${school}`;
    if (!s) throw new Error(`school ${school} not found`);
    const rules = JSON.parse(readFileSync(path.join(DIR, "links.json"), "utf8"));
    for (const file of readdirSync(DIR).filter((f) => /\.html?$/i.test(f))) {
      const [done] = await sql`select 1 from redirects where school_id = ${s.id} and path = ${file}`;
      if (done) continue;
      const page = readWishlistPage(path.join(DIR, file), rules);
      const cards = await sql`select id, name, role from staff_favorites where school_id = ${s.id}`;
      let joined = 0;
      await sql.begin(async (tx) => {
        for (const l of page.lists) {
          const card = matchCard(l.name, cards, rules);
          if (card) joined++;
          const [w] = await tx`insert into wishlists ${tx({ ...l, name: card?.name ?? l.name, staff_id: card?.id ?? null, school_id: s.id, imported: true, updated_by: "Imported from the old page" })} returning id`;
          // The card's "Classroom wishlist" button now opens this list on the new page.
          if (card) await tx`update staff_favorites set wishlist_href = ${`wishlists#wl-${w.id}`} where id = ${card.id} and wishlist_href = ${file}`;
        }
        await tx`update schools set wishlist_title = ${page.title}, wishlist_lead = ${page.lead}, wishlist_intro_html = ${page.notes}, wishlist_groups = ${tx.json(page.groups)}
          where id = ${s.id} and wishlist_title = '' and wishlist_intro_html = ''`;
        await tx`insert into redirects (school_id, path, target) values (${s.id}, ${file}, 'wishlists')`;
        await tx`update links set href = 'wishlists' where school_id = ${s.id} and href = ${file}`;
        // Any other card that still points to the old page.
        await tx`update staff_favorites set wishlist_href = 'wishlists' where school_id = ${s.id} and wishlist_href = ${file}`;
      });
      console.log(`seed-wishlists: imported ${page.lists.length} lists (${joined} joined to Staff favorites) from ${file}`);
    }
  } catch (e) {
    console.warn("seed-wishlists: skipped:", e instanceof Error ? e.message : e);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
