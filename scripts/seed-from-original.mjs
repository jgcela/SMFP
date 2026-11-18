// Builds the SQL that loads one school's portal content into the database,
// taken from the original portal page (reference/portal_202627.original.html).
//
//   node scripts/seed-from-original.mjs <school-slug> [out-dir]
//
// Writes <out-dir>/seed.sql (one file, for psql) and <out-dir>/seed.json
// (the same statements as a list). Running it twice for the same slug
// replaces that school's content; other schools are not touched.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import vm from "node:vm";
import path from "node:path";

const slug = process.argv[2];
const outDir = process.argv[3] || "tmp/seed";
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error("Usage: node scripts/seed-from-original.mjs <school-slug> [out-dir]");
  process.exit(1);
}

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const html = readFileSync(path.join(root, "reference/portal_202627.original.html"), "utf8");

// ---- Data blocks of the original page script (CONFIG, DOCS, MOST_USED, EVENTS) ----
const script = html.match(/<script>\n?([\s\S]*?)<\/script>/)[1];
const dataPart = script.slice(0, script.indexOf("(function () {"));
const { CONFIG, DOCS, MOST_USED, EVENTS } = vm.runInNewContext(`${dataPart};({ CONFIG, DOCS, MOST_USED, EVENTS })`);

// ---- Links and contact details from the page markup ----
const body = html.match(/<body>([\s\S]*?)<script>/)[1];
const block = (re) => { const m = body.match(re); if (!m) throw new Error(`Not found: ${re}`); return m[1]; };
const anchors = (s) => [...s.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)]
  .map(([, href, label]) => ({ href, label: label.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim() }));

const top = anchors(block(/<div class="util">([\s\S]*?)<\/div>\s*<\/div>/));
const sections = anchors(block(/<nav class="main-nav"[^>]*>([\s\S]*?)<\/nav>/));
const mobile = block(/<nav id="mobile-menu"[^>]*>([\s\S]*?)<\/nav>/);
const menuSections = anchors(mobile.match(/<ul>([\s\S]*?)<\/ul>/)[1]);
const menuMore = anchors(mobile.match(/<ul class="sub">([\s\S]*?)<\/ul>/)[1]);
const popular = anchors(block(/<div class="chips">([\s\S]*?)<\/div>/));
const factsTag = block(/(<a class="btn btn--gold btn-facts"[\s\S]*?<\/a>)/);
const facts = {
  href: factsTag.match(/href="([^"]*)"/)[1],
  short: factsTag.match(/>([^<]+)<span class="lbl-long">/)[1].trim(),
  long: factsTag.match(/<span class="lbl-long">([^<]*)<\/span>/)[1].replace(/&nbsp;/g, " ").trim(),
};

const phoneTile = block(/(<a class="ctile" href="tel:[^"]*">[\s\S]*?<\/a>)/);
const phone = { href: phoneTile.match(/href="([^"]*)"/)[1], display: phoneTile.match(/<span class="v">([^<]*)</)[1] };
const hours = block(/OFFICE HOURS<\/span><span class="v">([^<]*)</);
const legal = block(/<p class="legal">([^<]*)<\/p>/).split(" · ");
const [name, place] = legal;
const [city, region] = place.split(",").map((s) => s.trim());
const schoolYear = legal[2].match(/school year (.+)$/)[1];
const logoUrl = block(/<a class="logo"[^>]*><img src="([^"]*)"/)
  .replace(/^https:\/\/[^/]+\/portal\//, ""); // the logo is served by this app (assets/logo_white.png)

// ---- SQL ----
const q = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(q).join(",")}]::text[]`;
const sid = `(select id from schools where slug = ${q(slug)})`;

const stmts = [];
stmts.push(`insert into schools (slug, name, city, region, school_year, logo_url, phone_display, phone_href, email, office_hours, google_calendar_id, notice_auto_days)
values (${[slug, name, city, region, schoolYear, logoUrl, phone.display, phone.href, CONFIG.officeEmail, hours, CONFIG.googleCalendarId].map(q).join(", ")}, ${Number(CONFIG.alertDays)})
on conflict (slug) do update set name = excluded.name, city = excluded.city, region = excluded.region, school_year = excluded.school_year,
  logo_url = excluded.logo_url, phone_display = excluded.phone_display, phone_href = excluded.phone_href, email = excluded.email,
  office_hours = excluded.office_hours, google_calendar_id = excluded.google_calendar_id, notice_auto_days = excluded.notice_auto_days`);
for (const t of ["links", "documents", "document_categories", "events"]) stmts.push(`delete from ${t} where school_id = ${sid}`);

stmts.push(`insert into events (school_id, event_date, end_date, category, title, details, badges, link_url, sort_order) values\n` +
  EVENTS.map(([date, cat, title, detail, badges, url, end], i) =>
    `(${sid}, ${q(date)}, ${end ? q(end) : "null"}, ${q(cat)}, ${q(title)}, ${q(detail || "")}, ${arr(badges ? badges.split("|") : [])}, ${q(url || "")}, ${i})`).join(",\n"));

stmts.push(`insert into document_categories (school_id, key, name, description, sort_order) values\n` +
  DOCS.map((c, i) => `(${sid}, ${q(c.id)}, ${q(c.name)}, ${q(c.desc)}, ${i})`).join(",\n"));

const rank = new Map(MOST_USED.map(([c, i], r) => [`${c}:${i}`, r + 1]));
stmts.push(`insert into documents (school_id, category_id, title, href, meta, kind, keywords, added_on, sort_order, most_used_rank) values\n` +
  DOCS.flatMap((c) => c.items.map((it, i) =>
    `(${sid}, (select id from document_categories where school_id = ${sid} and key = ${q(c.id)}), ${q(it.t)}, ${q(it.h)}, ${q(it.m)}, ${q(it.type || "file")}, ${q(it.k || "")}, ${it.added ? q(it.added) : "null"}, ${i}, ${rank.get(`${c.id}:${i}`) ?? "null"})`)).join(",\n"));

const linkRows = [
  ...top.map((l, i) => ["top", l, i]),
  ...sections.map((l, i) => ["sections", l, i]),
  ...menuSections.map((l, i) => ["menu_sections", l, i]),
  ...menuMore.map((l, i) => ["menu_more", l, i]),
  ...popular.map((l, i) => ["popular", l, i]),
];
stmts.push(`insert into links (school_id, placement, label, short_label, href, sort_order) values\n` +
  [...linkRows.map(([p, l, i]) => `(${sid}, ${q(p)}, ${q(l.label)}, '', ${q(l.href)}, ${i})`),
   `(${sid}, 'facts', ${q(`${facts.short} ${facts.long}`)}, ${q(facts.short)}, ${q(facts.href)}, 0)`].join(",\n"));

mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "seed.sql"), "begin;\n" + stmts.map((s) => s + ";").join("\n\n") + "\ncommit;\n");
writeFileSync(path.join(outDir, "seed.json"), JSON.stringify(stmts));
console.log(`School "${name}" (${slug}): ${EVENTS.length} events, ${DOCS.length} document groups, ` +
  `${DOCS.reduce((n, c) => n + c.items.length, 0)} documents, ${linkRows.length + 1} links -> ${outDir}`);
