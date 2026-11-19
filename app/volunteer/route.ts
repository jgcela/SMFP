// The Volunteer page (step 6b): built from the school's volunteer opportunities.
// Open to everyone; families who signed in can sign up from it.
import { db } from "../../lib/db";
import { familyOfUser } from "../../lib/family";
import { todayIn } from "../../lib/my-family";
import { loadPortal, schoolSlug } from "../../lib/portal";
import { renderVolunteerPage } from "../../lib/render";
import { currentStaff } from "../../lib/staff";
import { loadOpportunities, SIGNUP_MESSAGE } from "../../lib/volunteer-db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { school, links, contacts } = await loadPortal(schoolSlug());
  const [[extra], opps, { user, staff }] = await Promise.all([
    db()<{ title: string; lead: string; intro: string; timezone: string }[]>`
      select volunteer_title as title, volunteer_lead as lead, volunteer_intro_html as intro, timezone from schools where id = ${school.id}`,
    loadOpportunities(school.id),
    currentStaff(),
  ]);
  const family = user ? await familyOfUser(user.id) : null;
  const signedIn = family?.status === "approved" ? "family" : user && staff ? "other" : null;
  const mine = new Set<number>();
  if (signedIn === "family" && family) {
    const rows = await db()<{ id: number }[]>`select opportunity_id as id from volunteer_signups where family_id = ${family.id}`;
    rows.forEach((r) => mine.add(r.id));
  }
  const m = new URL(req.url).searchParams.get("m") ?? "";
  const notice = m in SIGNUP_MESSAGE ? SIGNUP_MESSAGE[m as keyof typeof SIGNUP_MESSAGE] : undefined;
  const html = renderVolunteerPage(school, links, contacts, extra, [...opps], { signedIn, mine, notice, today: todayIn(extra.timezone || "UTC") });
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
