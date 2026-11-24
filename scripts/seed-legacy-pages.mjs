// Runs before each build (npm "prebuild"). Every old portal page kept in
// content/legacy/ that the school does not have in the page editor yet is added,
// published, with its first version marked "imported". A page already there, or
// one whose old address was redirected elsewhere, is left alone, so staff edits
// are never overwritten. Links in the portal that still point to the old address
// are moved to the new one. Never stops the build: problems are only reported.
import { readdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.PORTAL_DATABASE_URL;
const school = process.env.PORTAL_SCHOOL;
if (!url || !school) {
  console.log("seed-legacy-pages: no database configured, skipped");
  process.exit(0);
}
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  // Loaded here so that a problem reading the pages (e.g. an old Node) cannot stop the build.
  const { readLegacyPage, slugFor } = await import("./legacy-page.mjs");
  const [s] = await sql`select id from schools where slug = ${school}`;
  if (!s) throw new Error(`school ${school} not found`);
  const files = readdirSync(path.join(process.cwd(), "content/legacy")).filter((f) => /\.html?$/i.test(f)).sort();
  for (const file of files) {
    const slug = slugFor(file);
    const [done] = await sql`
      select 1 from pages where school_id = ${s.id} and (legacy_path = ${file} or slug = ${slug})
      union all select 1 from redirects where school_id = ${s.id} and path = ${file}`;
    if (done) continue;
    const page = readLegacyPage(file);
    const off = Object.entries(page.counts).filter(([, [a, b]]) => a !== b);
    if (!page.sameText || off.length) { console.warn(`seed-legacy-pages: ${file} not imported, the cleaned text differs`, off); continue; }
    await sql.begin(async (tx) => {
      const [p] = await tx`
        insert into pages (school_id, slug, legacy_path, draft_title, draft_summary, draft_html, title, summary, html, published_at)
        values (${s.id}, ${slug}, ${file}, ${page.title}, ${page.summary}, ${page.html}, ${page.title}, ${page.summary}, ${page.html}, now())
        returning id`;
      await tx`insert into page_versions (page_id, kind, title, summary, html, author)
        values (${p.id}, 'imported', ${page.title}, ${page.summary}, ${page.html}, 'Imported from the old page')`;
      await tx`update links set href = ${"pages/" + slug} where school_id = ${s.id} and href = ${file}`;
      await tx`update documents set href = ${"pages/" + slug} where school_id = ${s.id} and href = ${file}`;
    });
    console.log(`seed-legacy-pages: imported ${file} as /pages/${slug}`);
  }
} catch (e) {
  console.warn("seed-legacy-pages: skipped:", e instanceof Error ? e.message : e);
} finally {
  await sql.end({ timeout: 5 });
}
