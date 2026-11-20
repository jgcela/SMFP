// Old addresses of pages that now live in the editor (e.g. supply-list_202627.html)
// keep working: they send families to the page's new address. Old pages that were
// replaced by something else (e.g. a PDF) are listed in the redirects table.
import { db } from "../../lib/db";
import { notFound } from "../../lib/pages";
import { schoolSlug } from "../../lib/portal";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ legacy: string }> }) {
  const legacy = decodeURIComponent((await ctx.params).legacy);
  if (!/\.html?$/i.test(legacy)) return notFound();
  const [p] = await db()<{ slug: string }[]>`
    select p.slug from pages p join schools s on s.id = p.school_id
    where s.slug = ${await schoolSlug()} and p.legacy_path = ${legacy} and p.published_at is not null`;
  const url = new URL(req.url);
  if (p) return go(`/pages/${encodeURIComponent(p.slug)}${url.search}`);
  const [r] = await db()<{ target: string }[]>`
    select r.target from redirects r join schools s on s.id = r.school_id
    where s.slug = ${await schoolSlug()} and r.path = ${legacy}`;
  if (!r) return notFound();
  return go(/^(https?:)?\/\//.test(r.target) || r.target.startsWith("/") ? r.target : `/${r.target}`);
}

function go(location: string) {
  return new Response(null, { status: 308, headers: { Location: encodeURI(decodeURI(location)), "Cache-Control": "public, max-age=300" } });
}
