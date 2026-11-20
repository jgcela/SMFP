import { readFileSync } from "node:fs";
import path from "node:path";
import { opensInNewTabByDefault } from "./links";
import { mapsHref } from "./contact";
import { absolutePaths } from "./page-html";
import type { ContactPerson, Link, School } from "./portal";
import { staffAnchors, VISIBLE_FAVORITES, type StaffCard, type Team } from "./staff-favorites";
import { storeLabel, type Group, type Wishlist } from "./wishlists";
import { KINDS, spotsLabel, spotsLeft, whenLabel, type Opportunity, type VLink } from "./volunteer";

// The page markup, with {{...}} where each school's content goes.
const template = readFileSync(path.join(process.cwd(), "content/portal-template.html"), "utf8");
// Step 4e: the school's own text pages (Supply list, Handbook...).
const pageTemplate = readFileSync(path.join(process.cwd(), "content/page-template.html"), "utf8");
// Step 6b: the Volunteer page, built from volunteer_opportunities.
const volunteerTemplate = readFileSync(path.join(process.cwd(), "content/volunteer-template.html"), "utf8");
// Step 6c: Staff favorites, built from staff_favorites (families who signed in only).
const staffTemplate = readFileSync(path.join(process.cwd(), "content/staff-favorites-template.html"), "utf8");
// Step 6d: Teacher wishlists, built from wishlists (families who signed in only).
const wishlistTemplate = readFileSync(path.join(process.cwd(), "content/wishlists-template.html"), "utf8");

export const esc = (s: string) =>
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

// Step 9: the way in for families, next to FACTS on every public page.
const FAMILY_BUTTON = `        <a class="btn btn-family" href="/family" aria-label="Family sign-in"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span>Family<span class="lbl-fam-long">&nbsp;sign-in</span></span></a>
`;

export function schoolTitle(school: School) {
  return `Parent Portal — ${school.name}`;
}
export function schoolDescription(school: School) {
  return `Calendar, forms and school updates for ${school.name} families, school year ${school.school_year}.`;
}

// Step 4d: the address and the contact people. Both are empty until the school
// fills them in, and then the page is exactly as before.
function contactParts(school: School, people: ContactPerson[]) {
  const address = school.address.trim();
  const map = esc(mapsHref(address));
  const lines = address ? esc(address) : "";
  return {
    "contact.aside_address": address
      ? `          <a class="contact-line" href="${map}"><svg class="icon" aria-hidden="true"><use href="#i-pin"/></svg><span>${lines}</span><span class="sr-only">(opens the map)</span></a>\n`
      : "",
    "contact.tile_address": address
      ? `      <a class="ctile" href="${map}"><span class="k">Address</span><span class="v">${lines}</span><span class="sr-only">(opens the map)</span></a>\n`
      : "",
    "contact.people": people.length
      ? `    <div class="contact-people">
      <h3 class="h3">Who to contact</h3>
      <ul class="contact-grid">
${people.map((p) => `        <li class="ctile">${p.role ? `<span class="k">${esc(p.role)}</span>` : ""}<span class="v">${esc(p.name)}</span>${p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : ""}</li>\n`).join("")}      </ul>
    </div>
`
      : "",
  };
}

function schoolValues(school: School, links: Link[], people: ContactPerson[]) {
  const place = [school.city, school.region].filter(Boolean).join(", ");
  return {
    "school.name": esc(school.name),
    "school.logo_url": esc(school.logo_url),
    "school.logo_alt": esc(`${school.name}${school.city ? `, ${school.city}` : ""} — Parent Portal home`),
    "school.school_year": esc(school.school_year),
    "school.phone_href": esc(school.phone_href),
    "school.phone_display": esc(school.phone_display),
    "school.email": esc(school.email),
    "school.office_hours": esc(school.office_hours),
    "school.footer": esc(`${[school.name, place].filter(Boolean).join(", ")}. Parent Portal, school year ${school.school_year}.`),
    "family.button": FAMILY_BUTTON,
    "facts.button": factsButton(links.find((l) => l.placement === "facts")),
    ...contactParts(school, people),
  } as Record<string, string>;
}

function fill(tpl: string, values: Record<string, string>) {
  return tpl.replace(/\{\{([a-z_.]+)\}\}/g, (m, k: string) => {
    if (!(k in values)) throw new Error(`Unknown placeholder ${m}`);
    return values[k];
  });
}

export function renderPortal(school: School, links: Link[], people: ContactPerson[] = []) {
  const values = schoolValues(school, links, people);
  for (const [slot, { from, html }] of Object.entries(LINK_HTML)) {
    values[`links.${slot}`] = links.filter((l) => l.placement === from).map(html).join("");
  }
  return fill(template, values);
}

export type PagePart = { title: string; summary: string; body: string; headings: number; preview?: string };

// A text page: the same header and footer as the portal's other pages, and the
// handbook layout (contents on the side, search) when the page has enough headings.
// Header and footer of the portal's inner pages (text pages, Volunteer).
function innerPageValues(school: School, links: Link[], people: ContactPerson[], current = "") {
  const values = schoolValues(school, links, people);
  const logo = school.logo_url;
  values["school.logo_url"] = esc(logo && !/^(https?:)?\/\//.test(logo) && !logo.startsWith("/") ? `/${logo}` : logo);
  const top = links.filter((l) => l.placement === "top");
  const cur = (l: Link, html: string) => (current && l.href.replace(/^\//, "") === current ? html.replace("<a ", '<a aria-current="page" ') : html);
  values["links.nav"] = top.map((l) => `        ${cur(l, a(l, l.short_label || l.label))}\n`).join("");
  values["links.mobile"] = top.map((l) => `        <li>${cur(l, a(l, l.label))}</li>\n`).join("");
  return values;
}

export function renderSchoolPage(school: School, links: Link[], people: ContactPerson[], page: PagePart) {
  const values = innerPageValues(school, links, people);
  const toc = page.headings >= 3;
  values["page.title"] = esc(page.title);
  values["page.summary"] = esc(page.summary);
  values["page.lead"] = page.summary ? `            <p class="lead">${esc(page.summary)}</p>\n` : "";
  values["page.body"] = page.body;
  values["page.preview"] = page.preview ?? "";
  values["page.layout"] = toc ? "" : " hb--plain";
  values["page.bar"] = toc
    ? `    <div class="hb-bar">
      <button class="hb-toggle" id="hb-toggle" type="button" aria-controls="hb-side" aria-expanded="true">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <span>Contents</span>
      </button>
      <div class="hb-search" role="search">
        <label class="sr-only" for="doc-q">Search this page</label>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input id="doc-q" type="search" placeholder="Search this page…" autocomplete="off" aria-describedby="doc-count">
        <div class="hb-results" id="hb-results" hidden>
          <p class="small" id="doc-count" aria-live="polite"></p>
          <ol class="doc-results" id="doc-results"></ol>
        </div>
      </div>
    </div>
`
    : "";
  values["page.side"] = toc
    ? `      <aside class="hb-side" id="hb-side" aria-label="Contents">
        <p class="hb-side-label">Contents</p>
        <nav aria-label="Page contents" id="toc"></nav>
      </aside>
      <div class="hb-scrim" id="hb-scrim" hidden></div>
`
    : "";
  // Pages live under /pages/, so the portal's relative links (menu, contact...) must start at the site root.
  return absolutePaths(fill(pageTemplate, values));
}

// ---------- Volunteer (step 6b) ----------
export type VolunteerState = {
  signedIn: "family" | "other" | null; // a family of this school, someone else (staff), or nobody
  mine: Set<number>;                   // opportunities this family signed up for
  notice?: { text: string; error?: boolean };
  today: string;                       // YYYY-MM-DD in the school's time zone
};

const ext = (href: string) => /^https?:/i.test(href);
const icon = (name: string) => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const btn = (l: VLink, cls: string) =>
  `<a class="btn ${cls}" href="${esc(l.href)}"${ext(l.href) ? ' target="_blank" rel="noopener"' : ""}>${esc(l.label)}${ext(l.href) ? `${icon("ext")}<span class="sr-only">(opens in a new tab)</span>` : ""}</a>`;
// One line of the details: escaped, with **text** in bold (as the old page had <strong>).
const detailLine = (l: string) => esc(l).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

function signupBlock(o: Opportunity, st: VolunteerState) {
  const left = spotsLeft(o);
  const spots = `<p class="vol-spots${left === 0 ? " is-full" : ""}">${icon("users")}${esc(spotsLabel(o))}</p>`;
  const past = !!o.eventDate && o.eventDate < st.today;
  const form = (action: "join" | "leave", label: string, cls: string, disabled = false) =>
    `<form class="vol-form" method="post" action="/volunteer/signup"><input type="hidden" name="id" value="${o.id}"><input type="hidden" name="do" value="${action}"><button type="submit" class="btn ${cls}"${disabled ? " disabled" : ""}>${label}</button></form>`;
  let action: string;
  if (st.signedIn === "family" && st.mine.has(o.id)) {
    action = `<p class="vol-in">${icon("check")}You’re signed up</p>${past ? "" : form("leave", "Cancel my sign-up", "btn--outline")}`;
  } else if (past) {
    action = `<p class="small">This date has passed.</p>`;
  } else if (left === 0) {
    action = `<button type="button" class="btn btn--primary" disabled>Full</button>`;
  } else if (st.signedIn === "family") {
    action = form("join", "Sign up", "btn--primary");
  } else if (st.signedIn === "other") {
    action = `<p class="small">Families sign up here after signing in to their family account.</p>`;
  } else {
    action = `<a class="btn btn--primary" href="/family?next=${encodeURIComponent(`/volunteer#opp-${o.id}`)}">Sign in to sign up</a>`;
  }
  return `${spots}\n        <div class="card-actions vol-form">${action}</div>`;
}

// Like the old page: "8–15" never breaks across lines (a word joiner after the dash).
const ve = (s: string) => esc(s).replace(/(\d)–(\d)/g, "$1–\u2060$2");

function card(o: Opportunity, st: VolunteerState) {
  const when = whenLabel(o);
  const meta = [o.location && `<span>${icon("pin")}${ve(o.location)}</span>`, when && `<span>${icon("cal")}${ve(when)}</span>`, o.whoText && `<span>${icon("users")}${ve(o.whoText)}</span>`].filter(Boolean).join("");
  const links = o.portalSignup ? o.links : o.links.slice(1);
  const main = o.portalSignup ? signupBlock(o, st) : o.links[0] ? `<p class="card-actions">${btn(o.links[0], "btn--primary")}</p>` : "";
  const contact = [o.contactName && ve(o.contactName), o.contactEmail && `<a href="mailto:${ve(o.contactEmail)}">${ve(o.contactEmail)}</a>`, o.contactPhone && `<a href="tel:${ve(o.contactPhone.replace(/[^\d+]/g, ""))}">${ve(o.contactPhone)}</a>`].filter(Boolean).join(" — ");
  const lines = o.details.split("\n").filter(Boolean);
  const more = [
    o.description && `<p class="small">${ve(o.description)}</p>`,
    lines.length ? `<h4 class="caption">${ve(o.detailsTitle)}</h4>\n        <ul class="list">${lines.map((l) => `<li>${detailLine(l)}</li>`).join("")}</ul>` : "",
    contact && `<p class="small vol-contact"><strong>Contact:</strong> ${contact}</p>`,
    links.length || o.flyer ? `<p class="card-actions">${links.map((l) => btn(l, "btn--outline")).join("")}${o.flyer ? `<a class="btn btn--outline" href="${ve(o.flyer)}">View flyer</a>` : ""}</p>` : "",
  ].filter(Boolean).join("\n        ");
  return `      <article class="card" id="opp-${o.id}" data-kind="${o.kind}" aria-labelledby="opp-${o.id}-t">
      <span class="tag">${ve(o.area || KINDS[o.kind])}</span>
      <div><h3 id="opp-${o.id}-t">${ve(o.title)}</h3>${o.organizer ? `<p class="small">${ve(o.organizer)}</p>` : ""}</div>
      ${meta ? `<p class="meta">${meta}</p>` : ""}
      ${main}
      ${more ? `<details class="more"><summary>Details and contacts</summary><div class="body">
        ${more}
      </div></details>` : ""}
    </article>
`;
}

export type VolunteerPage = { title: string; lead: string; intro: string };

export function renderVolunteerPage(school: School, links: Link[], people: ContactPerson[], page: VolunteerPage, opps: Opportunity[], st: VolunteerState) {
  const values = innerPageValues(school, links, people, "volunteer");
  values["page.title"] = esc(page.title || "Volunteer");
  values["page.summary"] = esc(`Volunteer opportunities for ${school.name} families, ${school.school_year}.`);
  values["page.lead"] = page.lead ? `      <p class="lead" id="page-lead">${esc(page.lead)}</p>\n` : "";
  values["volunteer.intro"] = page.intro ? `  ${page.intro}\n` : "";
  values["volunteer.notice"] = st.notice ? `      <p class="vol-note${st.notice.error ? " vol-note--err" : ""}" role="status">${esc(st.notice.text)}</p>\n` : "";
  values["volunteer.chips"] = Object.entries(KINDS).map(([k, l]) => `          <button type="button" class="fchip" data-f="${k}" aria-pressed="false">${esc(l)}</button>\n`).join("");
  values["volunteer.count"] = opps.length ? `Showing ${opps.length} of ${opps.length} opportunities` : "No opportunities right now. Check back soon.";
  values["volunteer.cards"] = opps.map((o) => card(o, st)).join("");
  return absolutePaths(fill(volunteerTemplate, values));
}

// ---------- Staff favorites (step 6c) ----------
export type StaffPage = { title: string; lead: string; intro: string; teams: Team[] };
/** Who is looking: a family or staff member of this school, or why they cannot see the page. */
export type StaffViewer = "allowed" | "nobody" | "pending" | "other";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function staffCard(c: StaffCard, id: string) {
  const fav = (f: { label: string; value: string }) => `<div><dt>${ve(f.label)}</dt><dd>${ve(f.value)}</dd></div>`;
  const top = c.favorites.slice(0, VISIBLE_FAVORITES), rest = c.favorites.slice(VISIBLE_FAVORITES);
  const photo = c.photo ? `<img class="staff-photo" src="/staff-favorites/photo/${c.id}?v=${c.version}" alt="" width="56" height="56" loading="lazy">` : "";
  return `          <article class="card staff anchor"${id ? ` id="${id}"` : ""} aria-labelledby="sn-${c.id}" data-team="${esc(c.team)}" data-text="${esc(norm(`${c.name} ${c.role}`))}">
      <div class="staff-top${photo ? " staff-top--photo" : ""}">
        ${photo}<div><h3 id="sn-${c.id}">${ve(c.name)}</h3><p class="small">${ve(c.role)}</p></div>
      </div>
      <dl class="favs">${top.map(fav).join("")}</dl>${rest.length ? `<details class="more"><summary>More favorites (${rest.length})</summary><dl class="favs favs--more body">${rest.map(fav).join("")}</dl></details>` : ""}
      ${c.wishlistHref ? `<p class="card-actions"><a class="btn btn--outline" href="${esc(c.wishlistHref)}">Classroom wishlist</a></p>` : ""}
    </article>
`;
}

function staffBody(page: StaffPage, cards: StaffCard[]) {
  const anchors = staffAnchors(cards, page.teams);
  const idOf = (c: StaffCard) => anchors.get(c.id) ?? "";
  const teams: Team[] = [...page.teams];
  if (cards.some((c) => !teams.some((t) => t.key === c.team))) teams.push({ key: "", label: "Other staff" });
  const known = (c: StaffCard) => teams.some((t) => t.key === c.team);
  const shared = cards.filter((c) => c.favorites.length);
  const groups = teams.map((t) => {
    const g = shared.filter((c) => (known(c) ? c.team === t.key : t.key === ""));
    if (!g.length) return "";
    return `      <section class="stack staff-group" style="gap:16px" aria-label="${esc(t.label)}" data-team="${esc(t.key)}"><h3 class="h3">${esc(t.label)} <span class="caption">${g.length}</span></h3><div class="grid grid--staff">
${g.map((c) => staffCard(c, idOf(c))).join("")}      </div></section>
`;
  }).join("");
  const pending = cards.filter((c) => !c.favorites.length);
  const chips = [{ key: "all", label: "All" }, ...teams.filter((t) => cards.some((c) => (known(c) ? c.team === t.key : t.key === "")))]
    .map((t) => `<button type="button" class="fchip" data-f="${esc(t.key || "-")}" aria-pressed="${t.key === "all"}">${esc(t.label)}</button>`).join("");
  return `  <section class="section" aria-labelledby="staff-title">
    <div class="wrap stack">
      ${page.intro}
      <div class="toolbar">
        <div class="sec-head">
          <h2 class="h2" id="staff-title">Find a staff member</h2>
          <div class="rule"></div>
        </div>
        <div class="field">
          <label for="s-search">Search by name or role</label>
          <input id="s-search" type="search" placeholder="e.g. a last name or a grade">
        </div>
      </div>
      <div class="filters" role="group" aria-label="Filter by team" id="filters">${chips}</div>
      <p class="count" id="count" aria-live="polite">${shared.length ? `Showing ${shared.length} of ${shared.length} staff members` : "No staff favorites yet."}</p>
      <div id="groups" class="stack">
${groups}      </div>
      <div class="empty" id="empty" hidden><p><strong>No staff members match your search.</strong> Try a last name or a grade.</p></div>
      <p class="small" id="pending">${pending.length ? `Still to share their favorites: <span>${pending.map((c) => `<span data-team="${esc(known(c) ? c.team : "")}" data-text="${esc(norm(`${c.name} ${c.role}`))}">${ve(c.name)}</span>`).join("<span class=\"sep\">, </span>")}</span>.` : ""}</p>
    </div>
  </section>
`;
}

// The notice for someone who may not see a families-only page (Staff favorites, Wishlists).
function familiesOnly(viewer: Exclude<StaffViewer, "allowed">, what: string, pagePath: string) {
  const text = {
    nobody: [`Sign in to see ${what}`, "This page is only for families of the school. Sign in with your family account to see it."],
    pending: ["Your family account is not approved yet", "You can see this page once the school approves your family account. If it is taking long, contact the school office."],
    other: ["This page is for families of the school", "The account you signed in with cannot see this page. Sign out and sign in with your family account."],
  }[viewer];
  const button = viewer === "nobody"
    ? `<p class="card-actions"><a class="btn btn--primary" id="sf-signin" href="/family?next=${encodeURIComponent(pagePath)}">Sign in</a></p>
          <script>(function(){var a=document.getElementById("sf-signin");if(location.hash)a.href="/family?next="+encodeURIComponent("${pagePath}"+location.hash);})();</script>`
    : viewer === "other" ? `<p class="card-actions"><a class="btn btn--outline" href="/family">Go to family sign-in</a></p>` : "";
  return `  <section class="section" aria-labelledby="lock-title">
    <div class="wrap stack">
      <div class="note sf-lock" role="status">
        <svg class="icon" aria-hidden="true"><use href="#i-info"/></svg>
        <div class="stack" style="gap:8px">
          <h2 class="h3" id="lock-title">${esc(text[0])}</h2>
          <p>${esc(text[1])}</p>
          ${button}
        </div>
      </div>
    </div>
  </section>
`;
}

export function renderStaffPage(school: School, links: Link[], people: ContactPerson[], page: StaffPage, cards: StaffCard[], viewer: StaffViewer) {
  const values = innerPageValues(school, links, people, "staff-favorites");
  const title = page.title || "Staff favorite things";
  values["page.title"] = esc(title);
  values["page.crumb"] = esc(title);
  values["page.summary"] = esc(`Favorite drinks, snacks and treats of ${school.name} staff, for gift ideas. ${school.school_year}.`);
  values["page.lead"] = page.lead ? `      <p class="lead" id="page-lead">${esc(page.lead)}</p>\n` : "";
  values["staff.body"] = viewer === "allowed" ? staffBody(page, cards) : familiesOnly(viewer, "staff favorites", "/staff-favorites");
  return absolutePaths(fill(staffTemplate, values));
}

// ---------- Teacher wishlists (step 6d) ----------
export type WishlistPage = { title: string; lead: string; intro: string; groups: Group[] };

function wishCard(w: Wishlist, groupLabel: string, favAnchor: string) {
  const store = w.storeUrl
    ? `<a class="btn btn--primary" href="${esc(w.storeUrl)}" target="_blank" rel="noopener">${esc(storeLabel(w.storeUrl))}${icon("ext")}<span class="sr-only">(opens in a new tab)</span></a>`
    : "";
  const fav = favAnchor ? `<a class="btn btn--outline" href="/staff-favorites#${esc(favAnchor)}">Favorite things</a>` : "";
  return `          <article class="card wl" id="wl-${w.id}" aria-label="${esc(w.name)}" data-group="${esc(w.grp)}" data-text="${esc(norm(`${w.name} ${w.classText} ${groupLabel}`))}">
      <div><h3>${ve(w.name)}</h3>${w.classText ? `<p class="small">${ve(w.classText)}</p>` : ""}</div>
      ${store || fav ? `<p class="card-actions">${store}${fav}</p>` : ""}
    </article>
`;
}

function wishBody(page: WishlistPage, lists: Wishlist[], anchors: Map<number, string>) {
  const groups: Group[] = [...page.groups];
  const known = (w: Wishlist) => groups.some((g) => g.key === w.grp);
  if (lists.some((w) => !known(w))) groups.push({ key: "", label: "Other" });
  const inGroup = (w: Wishlist, k: string) => (known(w) ? w.grp === k : k === "");
  const sections = groups.map((g) => {
    const ls = lists.filter((w) => inGroup(w, g.key));
    if (!ls.length) return "";
    return `      <section aria-label="${esc(g.label)}" class="stack wl-group" style="gap:16px" data-group="${esc(g.key)}"><h3 class="h3">${esc(g.label)} <span class="caption" data-one="list" data-many="lists">${ls.length} list${ls.length > 1 ? "s" : ""}</span></h3><div class="grid grid--tight">
${ls.map((w) => wishCard(w, g.label, w.staffId ? anchors.get(w.staffId) ?? "" : "")).join("")}      </div></section>
`;
  }).join("");
  const chips = [{ key: "all", label: "All" }, ...groups.filter((g) => lists.some((w) => inGroup(w, g.key)))]
    .map((g) => `<button type="button" class="fchip" data-f="${esc(g.key || "-")}" aria-pressed="${g.key === "all"}">${esc(g.label)}</button>`).join("");
  return `  <section class="section" aria-labelledby="lists-title">
    <div class="wrap stack">
      ${page.intro}
      <div class="toolbar">
        <div class="sec-head">
          <h2 class="h2" id="lists-title">Find a teacher</h2>
          <div class="rule"></div>
        </div>
        <div class="field">
          <label for="t-search">Search by teacher or grade</label>
          <input id="t-search" type="search" placeholder="e.g. a last name, 3rd grade, Art">
        </div>
      </div>
      <div class="filters" role="group" aria-label="Filter by group" id="filters">${chips}</div>
      <p class="count" id="count" aria-live="polite">${lists.length ? `Showing ${lists.length} of ${lists.length} wishlists` : "No wishlists yet."}</p>
      <div id="groups" class="stack">
${sections}      </div>
      <div class="empty" id="empty" hidden><p><strong>No wishlists match your search.</strong> Not every teacher has a list. You can also check <a href="/staff-favorites">Staff favorite things</a> for gift ideas.</p></div>
    </div>
  </section>
`;
}

export function renderWishlistPage(school: School, links: Link[], people: ContactPerson[], page: WishlistPage, lists: Wishlist[], viewer: StaffViewer, anchors: Map<number, string>) {
  const values = innerPageValues(school, links, people, "wishlists");
  const title = page.title || "Teacher wishlists";
  values["page.title"] = esc(title);
  values["page.crumb"] = esc(title);
  values["page.summary"] = esc(`Classroom wishlists of ${school.name} teachers, ${school.school_year}.`);
  values["page.lead"] = page.lead ? `      <p class="lead" id="page-lead">${esc(page.lead)}</p>\n` : "";
  values["staff.body"] = viewer === "allowed" ? wishBody(page, lists, anchors) : familiesOnly(viewer, "the teacher wishlists", "/wishlists");
  return absolutePaths(fill(wishlistTemplate, values));
}
