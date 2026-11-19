// Runs before each build (npm "prebuild"). Step 6b: the old Volunteer page
// (content/volunteer/*.html) is imported once per school: its opportunities go to
// volunteer_opportunities (hidden from nobody, with their own sign-up as before),
// the title, lead and "steps" part go to the school, and the old address is sent to
// /volunteer. Once the redirect exists the import never runs again, so staff
// edits (or deletions) are never undone. Never stops the build.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import postgres from "postgres";

const url = process.env.PORTAL_DATABASE_URL;
const school = process.env.PORTAL_SCHOOL;
if (!url || !school) {
  console.log("seed-volunteer: no database configured, skipped");
  process.exit(0);
}

const unescape = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const text = (s) => unescape(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
// A list item of the old page -> one line of `details` (<strong> becomes **...**).
const line = (li) => unescape(li.replace(/<strong>([\s\S]*?)<\/strong>/g, "**$1**").replace(/<(?!\/?strong)[^>]+>/g, "")).replace(/\s+/g, " ").trim();

export function readVolunteerPage(file) {
  const src = readFileSync(file, "utf8");
  const m = src.match(/const OPPS = (\[[\s\S]*?\n\]);/);
  if (!m) throw new Error("no OPPS list in the page");
  const opps = vm.runInNewContext(`(${m[1]})`, {}, { timeout: 1000 });
  const pick = (re) => (src.match(re)?.[1] ?? "");
  const steps = pick(/(<section class="section" aria-labelledby="steps-title">[\s\S]*?<\/section>)/);
  return {
    title: text(pick(/<h1 id="page-title">([\s\S]*?)<\/h1>/)),
    lead: text(pick(/<p class="lead" id="page-lead">([\s\S]*?)<\/p>/)),
    steps,
    opps: opps.map((o, i) => ({
      kind: o.type, title: o.t, organizer: o.org ?? "", area: o.area ?? "", location: o.where ?? "", when_text: o.when ?? "",
      who_text: o.who ?? "", description: o.desc ?? "", details_title: o.sub ?? "Details", details: (o.li ?? []).map(line).join("\n"),
      links: (o.cta ?? []).map(([label, href]) => ({ label, href })), flyer: o.flyer ?? "", sort_order: i + 1,
    })),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    const [s] = await sql`select id from schools where slug = ${school}`;
    if (!s) throw new Error(`school ${school} not found`);
    const dir = path.join(process.cwd(), "content/volunteer");
    for (const file of readdirSync(dir).filter((f) => /\.html?$/i.test(f))) {
      const [done] = await sql`select 1 from redirects where school_id = ${s.id} and path = ${file}`;
      if (done) continue;
      const page = readVolunteerPage(path.join(dir, file));
      await sql.begin(async (tx) => {
        for (const o of page.opps) {
          await tx`insert into volunteer_opportunities ${tx({ ...o, links: tx.json(o.links), school_id: s.id, portal_signup: false, imported: true, updated_by: "Imported from the old page" })}`;
        }
        await tx`update schools set volunteer_title = ${page.title}, volunteer_lead = ${page.lead}, volunteer_intro_html = ${page.steps}
          where id = ${s.id} and volunteer_title = '' and volunteer_intro_html = ''`;
        await tx`insert into redirects (school_id, path, target) values (${s.id}, ${file}, 'volunteer')`;
        await tx`update links set href = 'volunteer' where school_id = ${s.id} and href = ${file}`;
      });
      console.log(`seed-volunteer: imported ${page.opps.length} opportunities from ${file}`);
    }
  } catch (e) {
    console.warn("seed-volunteer: skipped:", e instanceof Error ? e.message : e);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
