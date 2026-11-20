// Step 6b: loading volunteer opportunities and signing families up (server only).
import { db } from "./db";
import { OPP_COLUMNS, type Opportunity } from "./volunteer";

export async function loadOpportunities(schoolId: number, opts: { includeHidden?: boolean } = {}) {
  const sql = db();
  return sql<Opportunity[]>`
    select ${sql.unsafe(OPP_COLUMNS)} from volunteer_opportunities o
    where o.school_id = ${schoolId} ${opts.includeHidden ? sql`` : sql`and not o.hidden`}
    order by o.sort_order, o.id`;
}

export type SignupResult = "joined" | "left" | "full" | "already" | "closed" | "gone" | "not_in";

/** Signs a family up (or out). The spot check and the insert happen together, so two
 *  families can never take the last spot at the same time. */
export async function changeSignup(schoolId: number, familyId: number, oppId: number, join: boolean, today: string): Promise<SignupResult> {
  return db().begin(async (tx) => {
    const [o] = await tx<{ spots: number | null; portal_signup: boolean; hidden: boolean; event_date: string | null }[]>`
      select spots, portal_signup, hidden, event_date::text from volunteer_opportunities
      where id = ${oppId} and school_id = ${schoolId} for update`;
    if (!o || o.hidden || !o.portal_signup) return "gone";
    if (!join) {
      const r = await tx`delete from volunteer_signups where opportunity_id = ${oppId} and family_id = ${familyId}`;
      return r.count ? "left" : "not_in";
    }
    if (o.event_date && o.event_date < today) return "closed";
    const [{ n }] = await tx<{ n: number }[]>`select count(*)::int as n from volunteer_signups where opportunity_id = ${oppId}`;
    const [mine] = await tx`select 1 from volunteer_signups where opportunity_id = ${oppId} and family_id = ${familyId}`;
    if (mine) return "already";
    if (o.spots !== null && n >= o.spots) return "full";
    await tx`insert into volunteer_signups (school_id, opportunity_id, family_id) values (${schoolId}, ${oppId}, ${familyId})`;
    return "joined";
  });
}

export const SIGNUP_MESSAGE: Record<SignupResult | "signin", { text: string; error?: boolean }> = {
  joined: { text: "You’re signed up. Thank you for helping!" },
  left: { text: "Your sign-up was cancelled. The spot is free again." },
  full: { text: "Sorry, there are no spots left for this opportunity.", error: true },
  already: { text: "You were already signed up for this opportunity." },
  closed: { text: "This date has passed, so sign-ups are closed.", error: true },
  gone: { text: "This opportunity is no longer open for sign-ups. Reload the page.", error: true },
  not_in: { text: "You were not signed up for this opportunity." },
  signin: { text: "Sign in with your family account to sign up.", error: true },
};
