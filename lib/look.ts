// Design proposals (preview only): two alternative looks for the family portal and
// the panels, chosen with ?look=editorial | ?look=bento | ?look=current (proxy.ts
// keeps the choice in the portal_look cookie). Each look is one stylesheet in
// public/looks/ loaded after every other style, so nothing else changes: same
// pages, same data, same colours per school (panel_theme). Production never
// shows them.
import { cookies } from "next/headers";

import { LOOKS, LOOK_COOKIE, looksEnabled, type Look } from "./look-names";
export { LOOKS, LOOK_COOKIE, looksEnabled, type Look };

export async function currentLook(): Promise<Look | null> {
  if (!looksEnabled()) return null;
  const v = (await cookies()).get(LOOK_COOKIE)?.value;
  return (LOOKS as readonly string[]).includes(v ?? "") ? (v as Look) : null;
}

const NAMES: [string, string][] = [["current", "Current"], ["editorial", "A · Editorial"], ["bento", "B · Bento"]];

// The small switcher shown at the bottom of every page while the proposals are open.
export function switcherHtml(look: Look | null) {
  const on = look ?? "current";
  const items = NAMES.map(([k, label]) =>
    `<a href="?look=${k}"${k === on ? ' aria-current="true"' : ""}>${label}</a>`).join("");
  return `<nav class="look-switch" aria-label="Design proposal"><span>Design</span>${items}</nav>`;
}

export const lookLinkHtml = (look: Look | null) =>
  `<link rel="stylesheet" href="/looks/switch.css">${look ? `<link rel="stylesheet" href="/looks/${look}.css">` : ""}`;

// For the pages written as a full HTML document (inner pages, Volunteer, Staff favorites, Wishlists).
export async function withLook(html: string) {
  if (!looksEnabled()) return html;
  const look = await currentLook();
  return html
    .replace(/<html([^>]*)>/i, (_m, a) => `<html${a}${look ? ` data-look="${look}"` : ""}>`)
    .replace(/<\/head>/i, `${lookLinkHtml(look)}</head>`)
    .replace(/<\/body>(?![\s\S]*<\/body>)/i, `${switcherHtml(look)}</body>`);
}
