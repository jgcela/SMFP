// Prints SQL that adds one old portal page (content/legacy/*.html) to the page
// editor: published, with its first version marked "imported".
// Usage: node scripts/import-legacy-page.mjs <school_slug> <file.html> [new_slug] > import.sql
// On Vercel the same import runs by itself before each build: scripts/seed-legacy-pages.mjs.
import { readLegacyPage, slugFor } from "./legacy-page.mjs";

const [school, file, slug = file && slugFor(file)] = process.argv.slice(2);
if (!school || !file) {
  console.error("Usage: node scripts/import-legacy-page.mjs <school_slug> <file.html> [new_slug]");
  process.exit(1);
}
const page = readLegacyPage(file);
for (const [name, [a, b]] of Object.entries(page.counts)) console.error(`${name}: ${a} → ${b}${a === b ? "" : "  ← DIFFERENT"}`);
console.error(page.sameText ? "text: identical" : "text: DIFFERENT");

const q = (s) => `'${s.replace(/'/g, "''")}'`;
console.log(`with s as (select id from schools where slug = ${q(school)}),
c as (select ${q(page.title)}::text as title, ${q(page.summary)}::text as summary, ${q(page.html)}::text as html),
p as (
  insert into pages (school_id, slug, legacy_path, draft_title, draft_summary, draft_html, title, summary, html, published_at)
  select s.id, ${q(slug)}, ${q(file)}, c.title, c.summary, c.html, c.title, c.summary, c.html, now() from s, c
  returning id
)
insert into page_versions (page_id, kind, title, summary, html, author)
select p.id, 'imported', c.title, c.summary, c.html, 'Imported from the old page' from p, c;`);
