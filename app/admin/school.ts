import { db } from "../../lib/db";
import { schoolSlug } from "../../lib/portal";

export async function loadSchoolHeader() {
  const [s] = await db()<{ name: string; logo_url: string | null }[]>`
    select name, logo_url from schools where slug = ${schoolSlug()}`;
  const logo = s?.logo_url ?? null;
  // The portal stores the logo relative to the site root; make it work from /admin/... too.
  const logoUrl = logo && !/^(https?:)?\/\//.test(logo) && !logo.startsWith("/") ? `/${logo}` : logo;
  return { name: s?.name ?? "School portal", logoUrl };
}
