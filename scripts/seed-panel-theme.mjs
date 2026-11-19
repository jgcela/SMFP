// Runs before each build (npm "prebuild"). Step 7: the look of the private panels
// (content/panel/theme.json) is copied once into schools.panel_theme for the school
// in PORTAL_SCHOOL. If the school already has a look, nothing changes. Never stops the build.
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.PORTAL_DATABASE_URL;
const school = process.env.PORTAL_SCHOOL;
if (!url || !school) {
  console.log("seed-panel-theme: no database configured, skipped");
  process.exit(0);
}
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  const { _note, ...theme } = JSON.parse(readFileSync(path.join(process.cwd(), "content/panel/theme.json"), "utf8"));
  void _note;
  const r = await sql`update schools set panel_theme = ${sql.json(theme)} where slug = ${school} and panel_theme = '{}'::jsonb`;
  console.log(r.count ? "seed-panel-theme: panel look imported" : "seed-panel-theme: already set");
} catch (e) {
  console.log("seed-panel-theme: skipped:", e.message);
} finally {
  await sql.end();
}
