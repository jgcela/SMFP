// The portal's design, "Spotlight" (chosen 2026-11-22): one stylesheet loaded after
// every other style plus a motion layer (the Motion library), on every school's
// pages and the FAMITENLY panel. The rules are scoped to html[data-theme] and use
// each school's own colour variables (portal variables and panel_theme).
export const THEME = "spotlight";
export const THEME_CSS = "/theme/spotlight.css";
export const THEME_JS = "/theme/kit.js";

// For the pages written as a full HTML document (inner pages, Volunteer, Staff favorites, Wishlists).
export function withTheme(html: string) {
  return html
    .replace(/<html([^>]*)>/i, (_m, a) => `<html${a} data-theme="${THEME}">`)
    .replace(/<\/head>/i, `<link rel="stylesheet" href="${THEME_CSS}"><script src="${THEME_JS}" defer></script></head>`);
}
