// Step 11a: school years.
// The family portal always shows the school's active year. In the staff panel
// the school can switch to the year being prepared (to fill it in before
// families see it) or to an archived year (to look at it, without changing it).
// The year picked in the panel is remembered in a cookie per school; it is only
// a preference: the server checks that the year belongs to the school.
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { db } from "./db";
import { schoolSlug } from "./portal";

export type YearStatus = "preparing" | "active" | "archived";
export type Year = {
  id: number; school_id: number; label: string; starts_on: string; ends_on: string; status: YearStatus;
  logo_url: string; logo_key: string; panel_theme: unknown; modules: string[];
  phone_display: string; phone_href: string; email: string; office_hours: string; address: string;
  google_calendar_id: string; notice_auto_days: number; calendar_pdf_url: string; calendar_pdf_label: string;
  volunteer_title: string; volunteer_lead: string; volunteer_intro_html: string;
  staff_title: string; staff_lead: string; staff_intro_html: string; staff_teams: unknown;
  wishlist_title: string; wishlist_lead: string; wishlist_intro_html: string; wishlist_groups: unknown;
};

/** The active year of a school (every school has one). */
export const activeYear = cache(async (schoolId: number): Promise<Year> => {
  const [y] = await db()<Year[]>`
    select *, starts_on::text, ends_on::text from school_years where school_id = ${schoolId} and status = 'active'`;
  if (!y) notFound();
  return y;
});

/** The active year of this request's school, by its address. */
export const activeYearHere = cache(async (): Promise<Year & { school_name: string }> => {
  const [y] = await db()<(Year & { school_name: string })[]>`
    select y.*, y.starts_on::text, y.ends_on::text, s.name as school_name
    from school_years y join schools s on s.id = y.school_id
    where s.slug = ${await schoolSlug()} and y.status = 'active'`;
  if (!y) notFound();
  return y;
});

export const yearCookie = (schoolId: number) => `panel_year_${schoolId}`;

/** The year the staff panel is working on: the one picked, else the active one. */
export const panelYear = cache(async (schoolId: number): Promise<Year> => {
  const picked = Number((await cookies()).get(yearCookie(schoolId))?.value ?? 0);
  if (Number.isInteger(picked) && picked > 0) {
    const [y] = await db()<Year[]>`
      select *, starts_on::text, ends_on::text from school_years where id = ${picked} and school_id = ${schoolId}`;
    if (y) return y;
  }
  return activeYear(schoolId);
});

/** The panel's year for this request's school (for menus, before sign-in is known). */
export const panelYearHere = cache(async (): Promise<Year | null> => {
  const [s] = await db()<{ id: number }[]>`select id from schools where slug = ${await schoolSlug()}`;
  return s ? panelYear(s.id) : null;
});

export async function listYears(schoolId: number) {
  return db()<{ id: number; label: string; starts_on: string; ends_on: string; status: YearStatus; activated_at: Date | null; archived_at: Date | null; created_at: Date; copied_from_label: string | null }[]>`
    select y.id, y.label, y.starts_on::text, y.ends_on::text, y.status, y.activated_at, y.archived_at, y.created_at,
      (select c.label from school_years c where c.id = y.copied_from) as copied_from_label
    from school_years y where y.school_id = ${schoolId} order by y.starts_on desc`;
}

export const STATUS_LABEL: Record<YearStatus, string> = { preparing: "Being prepared", active: "Active", archived: "Archived" };

/** "2026–27" -> "2027–28". Keeps the dash the school uses. */
export function nextLabel(label: string) {
  const m = /^(\d{4})(\s*[–-]\s*)(\d{2}|\d{4})$/.exec(label.trim());
  if (!m) return "";
  const a = Number(m[1]) + 1;
  const b = m[3].length === 4 ? String(Number(m[3]) + 1) : String((Number(m[3]) + 1) % 100).padStart(2, "0");
  return `${a}${m[2]}${b}`;
}

/** The same day one year later, as yyyy-mm-dd (29 February becomes 28). */
export function plusYear(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dd = m === 2 && d === 29 ? 28 : d;
  return `${y + 1}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

/** The label for a school year starting in the given year: 2026 -> "2026–27". */
export const labelFor = (startYear: number) => `${startYear}–${String((startYear + 1) % 100).padStart(2, "0")}`;

/** In a staff page: "not found" when the year the panel works on has this module off. */
export async function requirePanelModule(id: string) {
  const y = await panelYearHere();
  if (!y || !y.modules.includes(id)) notFound();
}
