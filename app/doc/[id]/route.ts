// Opens an uploaded document: looks it up for this site's school and
// redirects to a short-lived signed link to the file in storage.
import { db } from "../../../lib/db";
import { schoolSlug } from "../../../lib/portal";
import { currentStaff } from "../../../lib/staff";
import { staffViewer } from "../../../lib/staff-favorites-db";
import { getStorage } from "../../../lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  // Families open the active year's documents; the school's staff, any year's (step 11a).
  const [d] = await db()<{ file_key: string; file_name: string; content_type: string; active: boolean }[]>`
    select d.file_key, d.file_name, d.content_type, y.status = 'active' as active
    from documents d join schools s on s.id = d.school_id join school_years y on y.id = d.year_id
    where d.id = ${id} and s.slug = ${await schoolSlug()} and d.file_key is not null`;
  if (d && !d.active && !(await currentStaff()).staff) return new Response("Not found", { status: 404 });
  if (!d) return new Response("Not found", { status: 404 });
  // Family documents are only for the school's approved families and its staff.
  if ((await staffViewer()) !== "allowed")
    return new Response(null, { status: 307, headers: { Location: `/s/${await schoolSlug()}/family?next=${encodeURIComponent(`/doc/${id}`)}`, "Cache-Control": "private, no-store" } });
  try {
    const url = await getStorage().signedGetUrl(d.file_key, { fileName: d.file_name, contentType: d.content_type, inline: true, expiresIn: 600 });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
  } catch {
    return new Response("This document is not available right now.", { status: 503 });
  }
}
