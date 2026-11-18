// Old addresses of pages that now live in the editor (e.g. supply-list_202627.html)
// keep working: they send families to the page's new address.
import { db } from "../../lib/db";
import { notFound } from "../../lib/pages";
import { schoolSlug } from "../../lib/portal";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ legacy: string }> }) {
  const legacy = decodeURIComponent((await ctx.params).legacy);
  if (!/\.html?$/i.test(legacy)) return notFound();
  const [p] = await db()<{ slug: string }[]>`
    select p.slug from pages p join schools s on s.id = p.school_id
    where s.slug = ${schoolSlug()} and p.legacy_path = ${legacy} and p.published_at is not null`;
  if (!p) return notFound();
  const url = new URL(req.url);
  return new Response(null, { status: 308, headers: { Location: `/pages/${encodeURIComponent(p.slug)}${url.search}`, "Cache-Control": "public, max-age=300" } });
}
