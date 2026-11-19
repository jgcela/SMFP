// Step 6d: Teacher wishlists. One list per teacher, joined to their Staff favorites
// card so the name is written once. Only families who signed in (and staff) see them.

export type WishItem = { id: number; name: string; url: string; quantity: number; done: boolean };
export type Group = { key: string; label: string };
export type Wishlist = {
  id: number; staffId: number | null; name: string; ownName: string; classText: string; grp: string;
  storeUrl: string; hidden: boolean; imported: boolean; items: WishItem[];
};

export const MAX_ITEMS = 60;

const clip = (s: FormDataEntryValue | null, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const isWeb = (s: string) => /^https:\/\/[^\s]+$/i.test(s);

/** "Amazon wishlist" for an Amazon link, "Online wishlist" for any other store. */
export function storeLabel(url: string) {
  try { return /(^|\.)amazon\./i.test(new URL(url).hostname) ? "Amazon wishlist" : "Online wishlist"; } catch { return "Online wishlist"; }
}

export type WishlistInput = {
  staffId: number | null; name: string; classText: string; grp: string; storeUrl: string; hidden: boolean;
  items: { id: number | null; name: string; url: string; quantity: number; done: boolean }[];
};

/** Reads the panel's form. Items come as item_name_N / item_url_N / item_qty_N / item_done_N / item_id_N. */
export function readWishlist(fd: FormData, groups: Group[]):
  { value: WishlistInput; error?: undefined; field?: undefined } | { value?: undefined; error: string; field?: string } {
  const staffRaw = clip(fd.get("staff_id"), 12);
  const staffId = staffRaw ? Number(staffRaw) : null;
  if (staffId !== null && !(Number.isInteger(staffId) && staffId > 0)) return { error: "Choose the teacher from the list.", field: "staff_id" };
  const name = clip(fd.get("name"), 100);
  if (staffId === null && !name) return { error: "Choose the teacher from Staff favorites, or write the name.", field: "name" };
  const grp = clip(fd.get("grp"), 40);
  if (grp && !groups.some((g) => g.key === grp)) return { error: "Choose a group from the list.", field: "grp" };
  const storeUrl = clip(fd.get("store_url"), 500);
  if (storeUrl && !isWeb(storeUrl)) return { error: "The store link must be a full address that starts with https://", field: "store_url" };
  const items: WishlistInput["items"] = [];
  for (let i = 0; i < MAX_ITEMS + 10; i++) {
    const iname = clip(fd.get(`item_name_${i}`), 200);
    const url = clip(fd.get(`item_url_${i}`), 500);
    const qtyRaw = clip(fd.get(`item_qty_${i}`), 4);
    if (!iname && !url) continue;
    if (!iname) return { error: "Each item needs a name.", field: `item_name_${i}` };
    if (url && !isWeb(url)) return { error: `The link of “${iname}” must start with https://`, field: `item_url_${i}` };
    const quantity = qtyRaw ? Number(qtyRaw) : 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 999) return { error: `The quantity of “${iname}” must be a whole number from 1 to 999.`, field: `item_qty_${i}` };
    const idRaw = Number(fd.get(`item_id_${i}`) || 0);
    items.push({ id: Number.isInteger(idRaw) && idRaw > 0 ? idRaw : null, name: iname, url, quantity, done: fd.get(`item_done_${i}`) === "on" });
  }
  if (items.length > MAX_ITEMS) return { error: `Up to ${MAX_ITEMS} items per list.` };
  return { value: { staffId, name, classText: clip(fd.get("class_text"), 150), grp, storeUrl, hidden: fd.get("hidden") === "on", items } };
}
