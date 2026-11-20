// Reads one of the old portal pages (content/legacy/*.html) and returns what the
// page editor needs: title, summary and the body, cleaned like the editor does.
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanPageHtml } from "../lib/page-html.ts";

const text = (s) => s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

/** The old file name without its school-year suffix: handbook_202627.html → handbook. */
export const slugFor = (file) => file.replace(/\.html?$/i, "").replace(/_\d{6}$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-");

export function readLegacyPage(file) {
  const src = readFileSync(path.join(process.cwd(), "content/legacy", file), "utf8");
  const h = src.indexOf('<header class="hb-head">');
  const head = src.slice(h, src.indexOf("</header>", h));
  const title = text(head.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] ?? "");
  const summary = text(head.match(/<p class="lead">([\s\S]*?)<\/p>/)?.[1] ?? "");
  const start = src.indexOf("</header>", src.indexOf('<article class="hb-paper')) + "</header>".length;
  const end = src.indexOf('<p class="hb-top">', start);
  if (h < 0 || !title || start < 9 || end < 0) throw new Error(`${file}: could not find the title or body`);
  const raw = src.slice(start, end);
  const html = cleanPageHtml(
    raw
      .replace(/<\/?section>/g, "")
      .replace(/<div>(<table>[\s\S]*?<\/table>)<\/div>/g, "$1")
      // Portal files are written relative to the site root; the editor shows them from /admin/pages/…
      .replace(/\s(href|src)="(?![a-z][a-z0-9+.-]*:|#|\/)([^"]*)"/gi, (_m, a, u) => ` ${a}="/${u}"`),
  ).replace(/\n{2,}/g, "\n");
  const counts = {};
  for (const [name, re] of [["headings", /<h[2-5][ >]/g], ["paragraphs", /<p[ >]/g], ["list items", /<li[ >]/g], ["table cells", /<t[dh][ >]/g], ["images", /<img /g], ["links", /<a /g]]) {
    counts[name] = [(raw.match(re) || []).length, (html.match(re) || []).length];
  }
  const plain = (s) => s.replace(/<[^>]*>/g, " ").replace(/&nbsp;| /g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
  return { title, summary, html, counts, sameText: plain(raw) === plain(html) };
}
