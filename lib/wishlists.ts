// Step 6d: Teacher wishlists. One list per teacher, joined to their Staff favorites
// card so the name is written once. The items themselves live in the teacher's store
// list (Amazon), linked from the card. Only families who signed in (and staff) see them.

export type Group = { key: string; label: string };
export type Wishlist = {
  id: number; staffId: number | null; name: string; ownName: string; classText: string; grp: string;
  storeUrl: string; hidden: boolean; imported: boolean;
};

const clip = (s: FormDataEntryValue | null, n: number) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const isWeb = (s: string) => /^https:\/\/[^\s]+$/i.test(s);

/** "Amazon wishlist" for an Amazon link, "Online wishlist" for any other store. */
export function storeLabel(url: string) {
  try { return /(^|\.)amazon\./i.test(new URL(url).hostname) ? "Amazon wishlist" : "Online wishlist"; } catch { return "Online wishlist"; }
}

export type WishlistInput = {
  staffId: number | null; name: string; classText: string; grp: string; storeUrl: string; hidden: boolean;
};

/** Reads the panel's form. */
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
  return { value: { staffId, name, classText: clip(fd.get("class_text"), 150), grp, storeUrl, hidden: fd.get("hidden") === "on" } };
}
