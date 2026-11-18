import { readFileSync } from "node:fs";
import path from "node:path";
import type { Link, School } from "./portal";

// The page markup, with {{...}} where each school's content goes.
const template = readFileSync(path.join(process.cwd(), "content/portal-template.html"), "utf8");

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

// Each list of links is written exactly the way the original page wrote it.
const LINK_HTML: Record<string, (l: Link) => string> = {
  top: (l) => `      <a href="${esc(l.href)}">${esc(l.label)}</a>\n`,
  sections: (l) => `        <a href="${esc(l.href)}">${esc(l.label)}</a>\n`,
  menu_sections: (l) => `        <li><a href="${esc(l.href)}">${esc(l.label)}</a></li>\n`,
  menu_more: (l) => `        <li><a href="${esc(l.href)}">${esc(l.label)}</a></li>\n`,
  popular: (l) => `        <a class="chip-link" href="${esc(l.href)}">${esc(l.label)}</a>\n`,
};

export function schoolTitle(school: School) {
  return `Parent Portal — ${school.name}`;
}
export function schoolDescription(school: School) {
  return `Calendar, forms and school updates for ${school.name} families, school year ${school.school_year}.`;
}

export function renderPortal(school: School, links: Link[]) {
  const facts = links.find((l) => l.placement === "facts");
  const factsShort = facts ? facts.short_label || facts.label : "";
  const factsLong = facts && facts.label.startsWith(factsShort) ? facts.label.slice(factsShort.length).trim() : "";
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
    "facts.href": esc(facts?.href ?? "#"),
    "facts.short": esc(factsShort),
    "facts.long": esc(factsLong),
  };
  for (const placement of Object.keys(LINK_HTML)) {
    values[`links.${placement}`] = links.filter((l) => l.placement === placement).map(LINK_HTML[placement]).join("");
  }
  return template.replace(/\{\{([a-z_.]+)\}\}/g, (m, k: string) => {
    if (!(k in values)) throw new Error(`Unknown placeholder ${m}`);
    return values[k];
  });
}
