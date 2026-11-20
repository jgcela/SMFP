import { cache } from "react";
import { db } from "../../lib/db";
import { readPanelTheme } from "../../lib/panel-theme";
import { schoolSlug } from "../../lib/portal";

// Name, logo, address start and panel look of this request's school (once per request).
export const loadSchoolHeader = cache(async () => {
  const slug = await schoolSlug();
  const base = `/s/${slug}`;
  const [s] = await db()<{ id: number; name: string; logo_url: string | null; panel_theme: unknown; modules: string[] }[]>`
    select id, name, logo_url, panel_theme, modules from schools where slug = ${slug}`;
  const logo = s?.logo_url ?? null;
  // The portal stores the logo relative to the school's home page; make it work from /admin/... too.
  const logoUrl = logo && !/^(https?:)?\/\//.test(logo) && !logo.startsWith("/") ? `${base}/${logo}` : logo;
  const name = s?.name ?? "School portal";
  const theme = readPanelTheme(s?.panel_theme, name);
  // The panel's small mark: bundled files keep their address; the school's own (e.g. "logo") is under its base.
  if (theme.markUrl && theme.markUrl.startsWith("/") && !theme.markUrl.startsWith("/assets/")) theme.markUrl = `${base}${theme.markUrl}`;
  return { id: s?.id ?? 0, slug, base, name, logoUrl, theme, modules: s?.modules ?? [] };
});
