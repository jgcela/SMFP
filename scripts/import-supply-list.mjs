// Step 4e: turns the old Supply list page (content/legacy/supply-list_202627.html)
// into a page of the editor, without losing any text or link.
//   node scripts/import-supply-list.mjs <school_slug>  > import.sql
// The SQL creates the page (published, so the old address keeps working) and
// its first version, marked "imported". Run it once in the database.
import { readFileSync } from "node:fs";

const school = process.argv[2];
if (!school) { console.error("Usage: node scripts/import-supply-list.mjs <school_slug>"); process.exit(1); }

const src = readFileSync(new URL("../content/legacy/supply-list_202627.html", import.meta.url), "utf8");
const start = src.indexOf("const SUPPLIES = ") + "const SUPPLIES = ".length;
const end = src.indexOf("];", start) + 1;
const SUPPLIES = JSON.parse(src.slice(start, end));
const pick = (re) => (re.exec(src)?.[1] ?? "").trim();
const unescape = (s) => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

const title = unescape(pick(/<h1 id="page-title">([^<]*)<\/h1>/));
const summary = unescape(pick(/<p class="lead" id="page-lead">([^<]*)<\/p>/));
const pdf = /<a class="btn btn--outline" href="([^"]+\.pdf)">([^<]+)<\/a>/.exec(src);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const LABEL = { yes: "Write your student’s name on each item", no: "Do not write your student’s name on these items" };

let html = "";
if (pdf) html += `<p><a href="${esc(pdf[1])}">${esc(unescape(pdf[2]))}</a></p>`;
let items = 0;
for (const g of SUPPLIES) {
  html += `<h2>${esc(g.title)}</h2>`;
  for (const c of g.groups) {
    html += `<h3>${esc(c.name.replace(/\s+—\s+(Do NOT label|Label) with student's name$/i, ""))}</h3>`;
    if (c.label) html += `<p><strong>${esc(LABEL[c.label])}</strong></p>`;
    html += `<ul data-type="taskList">${c.items.map((it) => { items++; return `<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>${esc(it)}</p></div></li>`; }).join("")}</ul>`;
  }
  if (g.note) html += `<blockquote><p>${esc(g.note)}</p></blockquote>`;
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
console.error(`${SUPPLIES.length} grades, ${items} items, PDF link: ${pdf ? "yes" : "no"}`);
console.log(`with s as (select id from schools where slug = ${q(school)}),
p as (
  insert into pages (school_id, slug, legacy_path, draft_title, draft_summary, draft_html, title, summary, html, published_at)
  select s.id, 'supply-list', 'supply-list_202627.html', ${q(title)}, ${q(summary)}, ${q(html)}, ${q(title)}, ${q(summary)}, ${q(html)}, now() from s
  returning id
)
insert into page_versions (page_id, kind, title, summary, html, author)
select p.id, 'imported', ${q(title)}, ${q(summary)}, ${q(html)}, 'Imported from the old page' from p;`);
