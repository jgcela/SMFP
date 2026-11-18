// Opens an uploaded document: looks it up for this site's school and
// redirects to a short-lived signed link to the file in storage.
import { db } from "../../../lib/db";
import { schoolSlug } from "../../../lib/portal";
import { getStorage } from "../../../lib/storage";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  const [d] = await db()<{ file_key: string; file_name: string; content_type: string }[]>`
    select d.file_key, d.file_name, d.content_type from documents d join schools s on s.id = d.school_id
    where d.id = ${id} and s.slug = ${schoolSlug()} and d.file_key is not null`;
  if (!d) return new Response("Not found", { status: 404 });
  try {
    const url = await getStorage().signedGetUrl(d.file_key, { fileName: d.file_name, contentType: d.content_type, inline: true, expiresIn: 600 });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, no-store" } });
  } catch {
    return new Response("This document is not available right now.", { status: 503 });
  }
}
