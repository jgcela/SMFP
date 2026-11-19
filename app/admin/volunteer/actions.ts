"use server";
// Staff manage the school's volunteer opportunities (step 6b). Only rows of this school.
import { revalidatePath } from "next/cache";
import { db } from "../../../lib/db";
import { requireStaff } from "../../../lib/staff";
import { readOpportunity } from "../../../lib/volunteer";

export type VolResult = { ok?: string; error?: string; field?: string };
const fail = (e: unknown): VolResult => ({ error: e instanceof Error ? e.message : "Something went wrong. Try again." });
const refresh = () => { revalidatePath("/admin/volunteer"); };

export async function saveOpportunity(fd: FormData): Promise<VolResult> {
  try {
    const staff = await requireStaff();
    const id = Number(fd.get("id") || 0);
    const r = readOpportunity(fd);
    if (!r.value) return { error: r.error, field: r.field };
    const v = r.value;
    const by = staff.name || staff.email;
    const sql = db();
    const cols = {
      kind: v.kind, title: v.title, organizer: v.organizer, area: v.area, description: v.description, location: v.location,
      event_date: v.eventDate, start_time: v.startTime, end_time: v.endTime, when_text: v.whenText, who_text: v.whoText, spots: v.spots,
      contact_name: v.contactName, contact_email: v.contactEmail, contact_phone: v.contactPhone, details_title: v.detailsTitle,
      details: v.details, links: sql.json(v.links), flyer: v.flyer, portal_signup: v.portalSignup, hidden: v.hidden, updated_by: by,
    };
    if (id) {
      if (v.spots !== null) {
        const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from volunteer_signups where opportunity_id = ${id} and school_id = ${staff.schoolId}`;
        if (n > v.spots) return { error: `${n} families are already signed up. Spots cannot be fewer than ${n}.`, field: "spots" };
      }
      const u = await sql`update volunteer_opportunities set ${sql(cols)}, updated_at = now() where id = ${id} and school_id = ${staff.schoolId}`;
      if (!u.count) return { error: "This opportunity is no longer in the list. Reload the page." };
    } else {
      const [n] = await sql<{ id: number }[]>`insert into volunteer_opportunities ${sql({ ...cols, school_id: staff.schoolId })} returning id`;
      await sql`update volunteer_opportunities set sort_order = (select coalesce(max(sort_order), 0) + 1 from volunteer_opportunities where school_id = ${staff.schoolId})
        where id = ${n.id}`;
    }
    refresh();
    return { ok: id ? `“${v.title}” saved.` : `“${v.title}” created${v.hidden ? " (hidden)" : ". It is on the Volunteer page now"}.` };
  } catch (e) { return fail(e); }
}

export async function setOpportunityHidden(id: number, hidden: boolean): Promise<VolResult> {
  try {
    const staff = await requireStaff();
    const [o] = await db()<{ title: string }[]>`
      update volunteer_opportunities set hidden = ${hidden}, updated_at = now(), updated_by = ${staff.name || staff.email}
      where id = ${id} and school_id = ${staff.schoolId} returning title`;
    if (!o) return { error: "This opportunity is no longer in the list. Reload the page." };
    refresh();
    return { ok: hidden ? `“${o.title}” is hidden. Families no longer see it; its sign-ups are kept.` : `“${o.title}” is visible on the Volunteer page again.` };
  } catch (e) { return fail(e); }
}

export async function deleteOpportunity(id: number): Promise<VolResult> {
  try {
    const staff = await requireStaff();
    const [o] = await db()<{ title: string }[]>`delete from volunteer_opportunities where id = ${id} and school_id = ${staff.schoolId} returning title`;
    if (!o) return { error: "This opportunity is no longer in the list. Reload the page." };
    refresh();
    return { ok: `“${o.title}” deleted, with its sign-ups.` };
  } catch (e) { return fail(e); }
}
