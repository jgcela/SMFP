// Writes lib/public-files.json: every file under public/, so the staff area can
// tell whether a link to one of the portal's own pages or files is spelled right.
// Runs before each build (npm "prebuild").
import { readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "public");
const out = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else out.push(path.relative(root, full).split(path.sep).join("/"));
  }
};
walk(root);
out.sort();
writeFileSync(path.join(process.cwd(), "lib/public-files.json"), JSON.stringify(out, null, 0) + "\n");
console.log(`lib/public-files.json: ${out.length} files`);
