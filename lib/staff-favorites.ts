// Step 6c: Staff favorites. One card per staff member, with their favorite things.
// Only families who signed in (and the school's staff) can see them.
// There is no birthday or allergy field on purpose: the school does not publish them.

export type Favorite = { label: string; value: string };
export type Team = { key: string; label: string };
export type StaffCard = {
  id: number; team: string; name: string; role: string; photo: boolean; favorites: Favorite[];
  wishlistHref: string; hidden: boolean; imported: boolean; version: string;
};

/** How many favorites are always visible; the rest go under "More favorites". */
export const VISIBLE_FAVORITES = 4;
export const MAX_FAVORITES = 20;
/** Suggested labels in the panel (any other text is allowed). */
export const FAVORITE_LABELS = [
  "Morning drink", "Afternoon drink", "Snacks", "Candy", "Sweet treat", "Lunch spot", "Dinner spot",
  "Adult beverage", "Favorite store", "Loves to treat themselves to", "Free time", "Not a fan of",
];
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_ACCEPT = ".png,.jpg,.jpeg,.gif,.webp";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
/** The old page's anchor: "staff-" + the last word of the name ("Mrs. McCallen/Fox" -> staff-fox). */
export const anchorOf = (name: string) => `staff-${norm(name.split(/[\s/]/).pop() ?? "").replace(/[^a-z-]/g, "")}`;

const clip = (s: FormDataEntryValue | null, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** Reads the panel's form. Favorites come as fav_label_N / fav_value_N rows; empty rows are dropped. */
export function readStaffCard(fd: FormData, teams: Team[]):
  { value: { team: string; name: string; role: string; favorites: Favorite[]; wishlistHref: string; hidden: boolean }; error?: undefined; field?: undefined }
  | { value?: undefined; error: string; field?: string } {
  const name = clip(fd.get("name"), 100);
  if (!name) return { error: "Write the name, for example: Mrs. Russell.", field: "name" };
  const role = clip(fd.get("role"), 150);
  const team = clip(fd.get("team"), 40);
  if (team && !teams.some((t) => t.key === team)) return { error: "Choose a group from the list.", field: "team" };
  const favorites: Favorite[] = [];
  for (let i = 0; i < MAX_FAVORITES + 5; i++) {
    const label = clip(fd.get(`fav_label_${i}`), 60);
    const value = clip(fd.get(`fav_value_${i}`), 300);
    if (!label && !value) continue;
    if (!label) return { error: "Each favorite needs a name, for example: Morning drink.", field: `fav_label_${i}` };
    if (!value) return { error: `Write the answer for “${label}”, or empty both boxes of that row.`, field: `fav_value_${i}` };
    favorites.push({ label, value });
  }
  if (favorites.length > MAX_FAVORITES) return { error: `Up to ${MAX_FAVORITES} favorites per person.` };
  const wishlistHref = clip(fd.get("wishlist_href"), 500);
  if (wishlistHref && !(/^https:\/\/\S+$/i.test(wishlistHref) || /^\/?[\w\-./%]+(#[\w-]*)?$/.test(wishlistHref)) || wishlistHref.startsWith("//"))
    return { error: "The wishlist link must be a full address that starts with https:// (or a page of the portal).", field: "wishlist_href" };
  return { value: { team, name, role, favorites, wishlistHref, hidden: fd.get("hidden") === "on" } };
}

/** The anchor of each card shown on the Staff favorites page, in page order (groups, then
 *  their order): the first card of a surname gets "staff-<surname>" like the old page,
 *  a second one "staff-<surname>-<id>". Cards with no favorites are not shown, so get none. */
export function staffAnchors(cards: StaffCard[], teams: Team[]) {
  const known = (c: StaffCard) => teams.some((t) => t.key === c.team);
  const ordered = [...teams.map((t) => t.key), ""].flatMap((k) =>
    cards.filter((c) => c.favorites.length && !c.hidden && (known(c) ? c.team === k : k === "")));
  const used = new Set<string>();
  const out = new Map<number, string>();
  for (const c of ordered) {
    let id = anchorOf(c.name);
    if (used.has(id)) id = `${id}-${c.id}`;
    used.add(id);
    out.set(c.id, id);
  }
  return out;
}
