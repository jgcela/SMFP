// A published text page, for families. Only the published copy is ever shown here.
import { findPublished, notFound, pageResponse } from "../../../lib/pages";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const page = await findPublished((await ctx.params).slug);
  return page ? pageResponse(page) : notFound();
}
