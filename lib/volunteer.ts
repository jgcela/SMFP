// Step 6b: volunteer opportunities. Labels, checks and formatting shared by the
// portal page, the staff area and the server. No school data here.

export const KINDS = { classroom: "Classroom", faith: "Faith & ministry", events: "Events" } as const;
export type Kind = keyof typeof KINDS;
export type VLink = { label: string; href: string };

export type Opportunity = {
  id: number; kind: Kind; title: string; organizer: string; area: string; description: string; location: string;
  eventDate: string | null; startTime: string | null; endTime: string | null; whenText: string; whoText: string;
  spots: number | null; contactName: string; contactEmail: string; contactPhone: string;
  detailsTitle: string; details: string; links: VLink[]; flyer: string; portalSignup: boolean; hidden: boolean;
  sortOrder: number; imported: boolean; taken: number;
};

/** Columns as the app uses them (dates and times as text, so no time zone moves them). */
export const OPP_COLUMNS = `o.id, o.kind, o.title, o.organizer, o.area, o.description, o.location,
  o.event_date::text as "eventDate", to_char(o.start_time, 'HH24:MI') as "startTime", to_char(o.end_time, 'HH24:MI') as "endTime",
  o.when_text as "whenText", o.who_text as "whoText", o.spots, o.contact_name as "contactName", o.contact_email as "contactEmail",
  o.contact_phone as "contactPhone", o.details_title as "detailsTitle", o.details, o.links, o.flyer, o.portal_signup as "portalSignup",
  o.hidden, o.sort_order as "sortOrder", o.imported,
  (select count(*)::int from volunteer_signups v where v.opportunity_id = o.id) as taken`;

/** "18:30" -> "6:30 p.m." (the style of the old page: "10:40 a.m.–12:30 p.m."). */
export function time12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "a.m." : "p.m."}`;
}

/** What the card shows next to the calendar icon. */
export function whenLabel(o: Pick<Opportunity, "eventDate" | "startTime" | "endTime" | "whenText">) {
  if (!o.eventDate) return o.whenText;
  const d = new Date(`${o.eventDate}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  const t = o.startTime ? ` · ${time12(o.startTime)}${o.endTime ? `–${time12(o.endTime)}` : ""}` : "";
  return `${d}${t}`;
}

/** Spots left, or null when there is no limit. */
export const spotsLeft = (o: Pick<Opportunity, "spots" | "taken">) => (o.spots === null ? null : Math.max(0, o.spots - o.taken));

export function spotsLabel(o: Pick<Opportunity, "spots" | "taken">) {
  const left = spotsLeft(o);
  if (left === null) return o.taken ? `${o.taken} ${o.taken === 1 ? "family" : "families"} signed up · no limit` : "No limit on spots";
  if (left === 0) return `Full · all ${o.spots} ${o.spots === 1 ? "spot" : "spots"} taken`;
  return `${left} of ${o.spots} ${o.spots === 1 ? "spot" : "spots"} left`;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Checks a link of a button: https://, mailto:, tel: or a file of the portal. */
export function checkLink(href: string): string | null {
  const h = href.trim();
  if (!h) return "Write the address of the button.";
  if (/\s/.test(h)) return "The button address has a space in it.";
  if (/^https:\/\/[^/\s]+\.[^/\s]+/i.test(h)) return null;
  if (/^http:\/\//i.test(h)) return "The address must start with https:// (with an “s”).";
  if (/^mailto:[^@\s]+@[^@\s]+\.[a-z]{2,}/i.test(h) || /^tel:\+?[\d-]{7,}$/i.test(h)) return null;
  if (/^\/?(assets|pages)\/[\w./%-]+$/i.test(h)) return null;
  return "Use a full address that starts with https://, or mailto: for an email, or tel: for a phone.";
}

export type OppInput = {
  kind: Kind; title: string; organizer: string; area: string; description: string; location: string;
  eventDate: string | null; startTime: string | null; endTime: string | null; whenText: string; whoText: string; spots: number | null;
  contactName: string; contactEmail: string; contactPhone: string; detailsTitle: string; details: string; links: VLink[]; flyer: string;
  portalSignup: boolean; hidden: boolean;
};

/** Reads and checks the staff form. Returns the values, or a message and the field to fix. */
export function readOpportunity(fd: FormData): { value?: OppInput; error?: string; field?: string } {
  const t = (k: string, max = 200) => String(fd.get(k) ?? "").trim().replace(/[ \t]+/g, " ").slice(0, max);
  const kind = t("kind") as Kind;
  if (!(kind in KINDS)) return { error: "Choose the type.", field: "kind" };
  const title = t("title");
  if (!title) return { error: "Write the title.", field: "title" };
  const eventDate = t("event_date") || null;
  if (eventDate && !ISO.test(eventDate)) return { error: "Choose the date.", field: "event_date" };
  const startTime = t("start_time") || null;
  const endTime = t("end_time") || null;
  if (startTime && !HM.test(startTime)) return { error: "Choose the start time.", field: "start_time" };
  if (endTime && !HM.test(endTime)) return { error: "Choose the end time.", field: "end_time" };
  if ((startTime || endTime) && !eventDate) return { error: "Choose the date for this time, or leave the times empty.", field: "event_date" };
  if (endTime && !startTime) return { error: "Choose the start time too.", field: "start_time" };
  if (startTime && endTime && endTime <= startTime) return { error: "The end time is before the start time.", field: "end_time" };
  const whenText = t("when_text", 80);
  if (!eventDate && !whenText) return { error: "Choose a date, or write when it happens (for example: Fridays · 10:40 a.m.).", field: "event_date" };
  const rawSpots = t("spots", 6);
  let spots: number | null = null;
  if (rawSpots) {
    spots = Number(rawSpots);
    if (!Number.isInteger(spots) || spots < 1 || spots > 1000) return { error: "Spots must be a whole number from 1 to 1000, or empty for no limit.", field: "spots" };
  }
  const contactEmail = t("contact_email", 200);
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(contactEmail)) return { error: "Check the contact email: it should look like name@example.com.", field: "contact_email" };
  const contactPhone = t("contact_phone", 40);
  if (contactPhone && !/^\+?[\d\s().-]{7,}$/.test(contactPhone)) return { error: "The contact phone can only have digits, spaces, dashes, dots and brackets.", field: "contact_phone" };
  const links: VLink[] = [];
  for (let i = 0; i < 6; i++) {
    const label = t(`link_label_${i}`, 60);
    const href = t(`link_href_${i}`, 500);
    if (!label && !href) continue;
    if (!label) return { error: "Write the text of the button.", field: `link_label_${i}` };
    const bad = checkLink(href);
    if (bad) return { error: bad, field: `link_href_${i}` };
    links.push({ label, href });
  }
  const flyer = t("flyer", 500);
  if (flyer) { const bad = checkLink(flyer); if (bad) return { error: `Flyer: ${bad}`, field: "flyer" }; }
  return {
    value: {
      kind, title, organizer: t("organizer"), area: t("area", 60), description: String(fd.get("description") ?? "").trim().slice(0, 3000),
      location: t("location"), eventDate, startTime, endTime, whenText, whoText: t("who_text", 80), spots,
      contactName: t("contact_name", 100), contactEmail, contactPhone, detailsTitle: t("details_title", 80) || "Details",
      details: String(fd.get("details") ?? "").split("\n").map((l) => l.trim()).filter(Boolean).join("\n").slice(0, 5000),
      links, flyer, portalSignup: fd.get("portal_signup") === "on", hidden: fd.get("hidden") === "on",
    },
  };
}
