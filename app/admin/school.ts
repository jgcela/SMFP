import { db } from "../../lib/db";
import { schoolSlug } from "../../lib/portal";

export async function loadSchoolHeader() {
  const [s] = await db()<{ name: string; logo_url: string | null }[]>`
    select name, logo_url from schools where slug = ${schoolSlug()}`;
  return { name: s?.name ?? "School portal", logoUrl: s?.logo_url ?? null };
}
