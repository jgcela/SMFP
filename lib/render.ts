import { readFileSync } from "node:fs";
import path from "node:path";
import { opensInNewTabByDefault } from "./links";
import type { Link, School } from "./portal";

// The page markup, with {{...}} where each school's content goes.
const template = readFileSync(path.join(process.cwd(), "content/portal-template.html"), "utf8");

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

// Each list of links is written exactly the way the original page wrote it.
// public/new-tab.js opens files and other websites in a new tab; a link only
// gets its own attribute when the school chose differently from that rule.
const tabAttr = (l: Link) =>
  l.new_tab === opensInNewTabByDefault(l.href) ? "" : l.new_tab ? ' target="_blank" rel="noopener"' : " data-same-tab";
const a = (l: Link, text: string, cls = "") => `<a${cls ? ` class="${cls}"` : ""} href="${esc(l.href)}"${tabAttr(l)}>${esc(text)}</a>`;

// The main menu ("top") is written twice: in the top bar, with the short text
// when there is one, and in the phone menu with the full text.
const LINK_HTML: Record<string, { from: string; html: (l: Link) => string }> = {
  top: { from: "top", html: (l) => `      ${a(l, l.short_label || l.label)}\n` },
  sections: { from: "sections", html: (l) => `        ${a(l, l.label)}\n` },
  menu_sections: { from: "menu_sections", html: (l) => `        <li>${a(l, l.label)}</li>\n` },
  menu_more: { from: "top", html: (l) => `        <li>${a(l, l.label)}</li>\n` },
  popular: { from: "popular", html: (l) => `        ${a(l, l.label, "chip-link")}\n` },
};

function factsButton(facts: Link | undefined) {
  if (!facts) return "";
  const short = facts.short_label || facts.label;
  const tab = facts.new_tab ? ' target="_blank" rel="noopener"' : "";
  // "FACTS Login" with short "FACTS": the original markup, where phones hide " Login".
  // Any other pair: the full text, swapped for the short one on phones.
  const text = facts.label.startsWith(short)
    ? `${esc(short)}<span class="lbl-long">&nbsp;${esc(facts.label.slice(short.length).trim())}</span>`
    : `<span class="lbl-full">${esc(facts.label)}</span><span class="lbl-short">${esc(short)}</span>`;
  return `        <a class="btn btn--gold btn-facts" href="${esc(facts.href)}"${tab}>${text}
          <svg class="icon" aria-hidden="true"><use href="#i-ext"/></svg>${facts.new_tab ? '<span class="sr-only">(opens in a new tab)</span>' : ""}</a>
`;
}

export function schoolTitle(school: School) {
  return `Parent Portal — ${school.name}`;
}
export function schoolDescription(school: School) {
  return `Calendar, forms and school updates for ${school.name} families, school year ${school.school_year}.`;
}

export function renderPortal(school: School, links: Link[]) {
  const place = [school.city, school.region].filter(Boolean).join(", ");
  const values: Record<string, string> = {
    "school.logo_url": esc(school.logo_url),
    "school.logo_alt": esc(`${school.name}${school.city ? `, ${school.city}` : ""} — Parent Portal home`),
    "school.school_year": esc(school.school_year),
    "school.phone_href": esc(school.phone_href),
    "school.phone_display": esc(school.phone_display),
    "school.email": esc(school.email),
    "school.office_hours": esc(school.office_hours),
    "school.footer": esc([school.name, place, `Parent Portal, school year ${school.school_year}`].filter(Boolean).join(" · ")),
    "facts.button": factsButton(links.find((l) => l.placement === "facts")),
  };
  for (const [slot, { from, html }] of Object.entries(LINK_HTML)) {
    values[`links.${slot}`] = links.filter((l) => l.placement === from).map(html).join("");
  }
  return template.replace(/\{\{([a-z_.]+)\}\}/g, (m, k: string) => {
    if (!(k in values)) throw new Error(`Unknown placeholder ${m}`);
    return values[k];
  });
}
