import { cache } from "react";
import { db } from "../../lib/db";
import { readPanelTheme } from "../../lib/panel-theme";
import { schoolSlug } from "../../lib/portal";

// Name, logo and panel look of this deployment's school (once per request).
export const loadSchoolHeader = cache(async () => {
  const [s] = await db()<{ name: string; logo_url: string | null; panel_theme: unknown }[]>`
    select name, logo_url, panel_theme from schools where slug = ${schoolSlug()}`;
  const logo = s?.logo_url ?? null;
  // The portal stores the logo relative to the site root; make it work from /admin/... too.
  const logoUrl = logo && !/^(https?:)?\/\//.test(logo) && !logo.startsWith("/") ? `/${logo}` : logo;
  const name = s?.name ?? "School portal";
  return { name, logoUrl, theme: readPanelTheme(s?.panel_theme, name) };
});
