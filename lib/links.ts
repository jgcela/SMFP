// Links the school edits from the staff area: "Popular", the main menu and the
// FACTS button. Shared by the browser (to warn before saving) and the server
// (which checks again). No database or Node code here.
import publicFiles from "./public-files.json";

export type LinkGroup = "popular" | "top" | "facts";
export const LINK_GROUPS: { key: LinkGroup; name: string; lead: string }[] = [
  { key: "popular", name: "Popular", lead: "The “Popular” shortcuts under the search box on the home page." },
  { key: "top", name: "Main menu", lead: "The links at the very top of the portal, and in the phone menu under the sections." },
  { key: "facts", name: "FACTS button", lead: "The gold button next to the menu. It can be changed or hidden, but not deleted." },
];

// Sections of the home page a link can jump to.
export const PORTAL_SECTIONS: { href: string; name: string }[] = [
  { href: "#this-week", name: "This week" },
  { href: "#documents", name: "Family documents" },
  { href: "#most", name: "Most used documents" },
  { href: "#calendar", name: "Calendar" },
  { href: "#contact", name: "Contact" },
  { href: "#top", name: "Top of the page" },
];

// The portal's own pages, with a readable name for the address suggestions.
const PAGE_NAMES: Record<string, string> = {
  "handbook_202627.html": "Handbook",
  "preschool-handbook_202627.html": "Preschool handbook",
  "supply-list_202627.html": "Supply list",
  "volunteer-opportunities_202627.html": "Volunteer opportunities",
  "teacher-wishlists_202627.html": "Teacher wishlists",
  "staff-favorites_202627.html": "Staff favorite things",
  "messenger-archive_202627.html": "School Messenger",
};
export const PORTAL_PAGES = Object.entries(PAGE_NAMES)
  .filter(([href]) => (publicFiles as string[]).includes(href))
  .map(([href, name]) => ({ href, name }));

const FILES = new Set(publicFiles as string[]);

// Same rule as public/new-tab.js: files and other websites open in a new tab;
// the portal's own pages and its sections open in the same tab.
export function opensInNewTabByDefault(href: string) {
  const h = href.trim();
  if (/^(#|mailto:|tel:|sms:)/i.test(h)) return false;
  if (/^https?:\/\//i.test(h)) return true;
  const path = h.replace(/^\//, "").split("#")[0];
  return !(path === "" || /_202627\.html$/.test(path));
}

const HOST = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24}|xn--[a-z0-9-]{2,59})$/i;

// Returns a message when the address looks wrong, or null when it is fine.
// categoryKeys: the document categories, which the portal shows as #cat-<key>.
export function checkHref(raw: string, categoryKeys: string[]): string | null {
  const href = raw.trim();
  if (!href) return "Enter the address.";
  if (/\s/.test(href)) return "The address has a space in it. Check that it is written correctly.";
  if (/^http:\/\//i.test(href)) return "The address must start with https:// (with an “s”), not http://.";
  if (/^https:\/\//i.test(href)) {
    let url: URL;
    try {
      url = new URL(href);
    } catch {
      return "This address is not written correctly.";
    }
    if (!HOST.test(url.hostname) || /^https:\/\/[^/]*\.\./i.test(href))
      return `“${url.hostname}” does not look like a website name. Check that the address is written correctly.`;
    return null;
  }
  if (href.startsWith("#")) {
    const ok = PORTAL_SECTIONS.some((s) => s.href === href) || categoryKeys.some((k) => `#cat-${k}` === href);
    return ok ? null : "That section does not exist on the portal. Pick one from the suggestions.";
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || /^(www\.|[a-z0-9-]+\.(com|org|net|edu|gov|us|io|me)\b)/i.test(href) || href.startsWith("//"))
    return "The address must start with https://";
  // A page or file of the portal itself, like "handbook_202627.html".
  const [rawPath] = href.replace(/^\//, "").split("#");
  let path = rawPath;
  try {
    path = decodeURI(rawPath);
  } catch {
    return "This address is not written correctly.";
  }
  if (path === "" || FILES.has(path)) return null;
  return "There is no page or file with that name on the portal. Check the spelling, or use a full address that starts with https://";
}
