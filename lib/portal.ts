import { cache } from "react";
import { db } from "./db";

// Which school this deployment shows. Each school's content lives in the
// database under its own school_id; nothing about a specific school is in the code.
export function schoolSlug() {
  const slug = process.env.PORTAL_SCHOOL;
  if (!slug) throw new Error("PORTAL_SCHOOL is not set");
  return slug;
}

export type School = {
  id: number; slug: string; name: string; city: string; region: string; school_year: string;
  logo_url: string; phone_display: string; phone_href: string; email: string; office_hours: string;
  google_calendar_id: string; notice_auto_days: number;
};
export type Link = { placement: string; label: string; short_label: string; href: string; new_tab: boolean };

// The data the page script (public/portal.js) works with, in the shapes it expects.
export type PortalData = {
  config: { googleCalendarId: string; officeEmail: string; alertDays: number };
  // Active notices; the page shows the newest one whose dates include today
  // (checked in the browser, like every other date on the page).
  notices: { message: string; linkLabel: string; linkHref: string; from: string; until: string }[];
  docs: { id: string; name: string; desc: string; items: { t: string; h: string; m: string; d?: string; type?: string; k: string; added?: string }[] }[];
  mostUsed: [string, number][];
  // [date, category, title, details, badges, link, endDate]
  events: [string, string, string, string, string, string, string?][];
};

/** "18:30:00" -> "6:30 pm" (the format the portal has always used). */
export function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

const iso = (d: Date | string | null) => {
  if (!d) return "";
  if (typeof d === "string") return d.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// cache(): the title and the page share one set of queries per request.
export const loadPortal = cache(async function loadPortal(slug: string) {
  const sql = db();
  const [school] = await sql<School[]>`select * from schools where slug = ${slug}`;
  if (!school) throw new Error(`No school with slug "${slug}"`);

  // Dates come back as text so no time zone can move them by a day.
  const [notices, events, cats, docs, links] = await Promise.all([
    sql<{ message: string; link_label: string; link_href: string; show_from: string | null; show_until: string | null }[]>`
      select message, link_label, link_href, show_from::text, show_until::text from notices
      where school_id = ${school.id} and is_active order by created_at desc, id desc`,
    sql<{ event_date: string; end_date: string | null; start_time: string | null; category: string; title: string; details: string; badges: string[]; link_url: string }[]>`
      select event_date::text, end_date::text, start_time::text, category, title, details, badges, link_url
      from events where school_id = ${school.id} order by event_date, sort_order, id`,
    sql<{ id: number; key: string; name: string; description: string }[]>`
      select id, key, name, description from document_categories where school_id = ${school.id} order by sort_order, id`,
    sql<{ category_id: number; title: string; href: string; meta: string; description: string; kind: string; keywords: string; added_on: string | null; most_used_rank: number | null }[]>`
      select category_id, title, href, meta, description, kind, keywords, added_on::text, most_used_rank
      from documents where school_id = ${school.id} order by sort_order, id`,
    sql<Link[]>`select placement, label, short_label, href, new_tab from links where school_id = ${school.id} and not hidden order by sort_order, id`,
  ]);

  const docGroups = cats.map((c) => {
    const items = docs.filter((d) => d.category_id === c.id);
    return { cat: c, items };
  });
  const mostUsed = docGroups
    .flatMap(({ cat, items }) => items.map((d, i) => ({ key: cat.key, i, rank: d.most_used_rank })))
    .filter((x) => x.rank !== null)
    .sort((a, b) => (a.rank as number) - (b.rank as number))
    .map((x) => [x.key, x.i] as [string, number]);

  const data: PortalData = {
    config: { googleCalendarId: school.google_calendar_id, officeEmail: school.email, alertDays: school.notice_auto_days },
    notices: notices.map((n) => ({ message: n.message, linkLabel: n.link_label, linkHref: n.link_href, from: iso(n.show_from), until: iso(n.show_until) })),
    docs: docGroups.map(({ cat, items }) => ({
      id: cat.key, name: cat.name, desc: cat.description,
      items: items.map((d) => ({
        // The optional short description is shown as plain text under the title, not inside the link line.
        t: d.title, h: d.href, m: d.meta,
        ...(d.description ? { d: d.description } : {}),
        k: [d.keywords, d.description].filter(Boolean).join(" "),
        ...(d.kind !== "file" ? { type: d.kind } : {}),
        ...(d.added_on ? { added: iso(d.added_on) } : {}),
      })),
    })),
    mostUsed,
    events: events.map((e) => {
      const details = e.start_time ? formatTime(e.start_time) + (e.details ? `, ${e.details}` : "") : e.details;
      const row: PortalData["events"][number] = [iso(e.event_date), e.category, e.title, details, e.badges.join("|"), e.link_url];
      if (e.end_date) row.push(iso(e.end_date));
      return row;
    }),
  };
  return { school, links, data };
});
