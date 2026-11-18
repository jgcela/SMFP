// Staff preview of a page's draft, with a banner so it is never mistaken for the published page.
import { db } from "../../../../../lib/db";
import { notFound, pageResponse, type PageCopy } from "../../../../../lib/pages";
import { currentStaff } from "../../../../../lib/staff";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { staff } = await currentStaff();
  if (!staff) return new Response(null, { status: 302, headers: { Location: "/admin" } });
  const id = Number((await ctx.params).id);
  const [p] = await db()<PageCopy[]>`
    select draft_title as title, draft_summary as summary, draft_html as html from pages where id = ${id} and school_id = ${staff.schoolId}`;
  if (!p) return notFound();
  return pageResponse(p, `  <p class="page-preview">Preview of the draft. Families do not see these changes until you press “Publish”.</p>\n`);
}
