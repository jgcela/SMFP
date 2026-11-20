// The name of the signed-in family (approved only), so the public pages can
// show it on the header button instead of "Family sign-in". Nothing else.
import { currentFamily } from "../../../lib/family";

export const dynamic = "force-dynamic";

export async function GET() {
  const family = await currentFamily().catch(() => null);
  return Response.json({ family: family ? family.name : null }, { headers: { "Cache-Control": "private, no-store" } });
}
