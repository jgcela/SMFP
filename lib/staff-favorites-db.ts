// Step 6c: loading Staff favorites, and who may see them (server only).
import { db } from "./db";
import { familyOfUser } from "./family";
import { currentStaff } from "./staff";
import type { StaffCard, Team } from "./staff-favorites";
import type { StaffViewer } from "./render";

const COLUMNS = `id, team, name, role, photo_key is not null as photo, favorites, wishlist_href as "wishlistHref",
  hidden, imported, extract(epoch from updated_at)::bigint::text as version`;

export async function loadStaffCards(yearId: number, opts: { includeHidden?: boolean } = {}) {
  const sql = db();
  return sql<StaffCard[]>`
    select ${sql.unsafe(COLUMNS)} from staff_favorites
    where year_id = ${yearId} ${opts.includeHidden ? sql`` : sql`and not hidden`}
    order by sort_order, id`;
}

export async function loadStaffPage(yearId: number) {
  const [s] = await db()<{ title: string; lead: string; intro: string; teams: Team[] }[]>`
    select staff_title as title, staff_lead as lead, staff_intro_html as intro, staff_teams as teams from school_years where id = ${yearId}`;
  return s ?? { title: "", lead: "", intro: "", teams: [] };
}

/** Families the school approved, and the school's staff, see the page. Nobody else. */
export async function staffViewer(): Promise<StaffViewer> {
  const { user, staff } = await currentStaff();
  if (!user) return "nobody";
  if (staff) return "allowed";
  const f = await familyOfUser(user.id);
  if (f?.status === "approved") return "allowed";
  return f?.status === "pending" ? "pending" : "other";
}
