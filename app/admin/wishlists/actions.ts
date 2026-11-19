"use server";
// Staff manage the school's Teacher wishlists (step 6d). Only rows of this school.
import { revalidatePath } from "next/cache";
import { db } from "../../../lib/db";
import { requireStaff } from "../../../lib/staff";
import { readWishlist } from "../../../lib/wishlists";
import { loadWishlistPage } from "../../../lib/wishlists-db";

export type WlResult = { ok?: string; error?: string; field?: string };
const fail = (e: unknown): WlResult => ({ error: e instanceof Error ? e.message : "Something went wrong. Try again." });
const refresh = () => { revalidatePath("/admin/wishlists"); };
const GONE = "This list is no longer there. Reload the page.";

export async function saveWishlist(fd: FormData): Promise<WlResult> {
  try {
    const staff = await requireStaff();
    const id = Number(fd.get("id") || 0);
    const { groups } = await loadWishlistPage(staff.schoolId);
    const r = readWishlist(fd, groups);
    if (!r.value) return { error: r.error, field: r.field };
    const v = r.value;
    const by = staff.name || staff.email;
    let name = v.name;
    let saved = "";
    await db().begin(async (tx) => {
      if (v.staffId !== null) {
        const [card] = await tx<{ name: string }[]>`select name from staff_favorites where id = ${v.staffId} and school_id = ${staff.schoolId}`;
        if (!card) throw new Error("That teacher is no longer in Staff favorites. Choose again.");
        name = card.name; // a copy, used only if the card is deleted later
      }
      const cols = { staff_id: v.staffId, name, class_text: v.classText, grp: v.grp, store_url: v.storeUrl, hidden: v.hidden, updated_by: by };
      let listId = id;
      if (id) {
        const u = await tx`update wishlists set ${tx(cols)}, updated_at = now() where id = ${id} and school_id = ${staff.schoolId}`;
        if (!u.count) throw new Error(GONE);
      } else {
        const [n] = await tx<{ id: number }[]>`insert into wishlists ${tx({ ...cols, school_id: staff.schoolId })} returning id`;
        listId = n.id;
        await tx`update wishlists set sort_order = (select coalesce(max(sort_order), 0) + 1 from wishlists where school_id = ${staff.schoolId}) where id = ${listId}`;
      }
      // Items: keep the ones still in the form (by id), add the new ones, remove the rest.
      const keep = v.items.map((i) => i.id).filter((x): x is number => x !== null);
      await tx`delete from wishlist_items where wishlist_id = ${listId} and school_id = ${staff.schoolId}
        ${keep.length ? tx`and id not in ${tx(keep)}` : tx``}`;
      for (const [n, it] of v.items.entries()) {
        const row = { name: it.name, url: it.url, quantity: it.quantity, done: it.done, sort_order: n + 1 };
        const u = it.id
          ? await tx`update wishlist_items set ${tx(row)}, done_at = case when ${it.done} then coalesce(done_at, now()) else null end
              where id = ${it.id} and wishlist_id = ${listId} and school_id = ${staff.schoolId}`
          : { count: 0 };
        if (!u.count) await tx`insert into wishlist_items ${tx({ ...row, wishlist_id: listId, school_id: staff.schoolId, done_at: it.done ? new Date() : null })}`;
      }
      const got = v.items.filter((i) => i.done).length;
      saved = `${name}’s list ${id ? "saved" : "created"}${v.items.length ? ` (${v.items.length} item${v.items.length === 1 ? "" : "s"}${got ? `, ${got} got` : ""})` : ""}${v.hidden ? ", hidden" : ""}.`;
    });
    refresh();
    return { ok: saved };
  } catch (e) { return fail(e); }
}

export async function setWishlistHidden(id: number, hidden: boolean): Promise<WlResult> {
  try {
    const staff = await requireStaff();
    const [w] = await db()<{ name: string }[]>`
      update wishlists w set hidden = ${hidden}, updated_at = now(), updated_by = ${staff.name || staff.email}
      where w.id = ${id} and w.school_id = ${staff.schoolId}
      returning coalesce((select f.name from staff_favorites f where f.id = w.staff_id), w.name) as name`;
    if (!w) return { error: GONE };
    refresh();
    return { ok: hidden ? `${w.name}’s list is hidden. Families no longer see it.` : `${w.name}’s list is visible again.` };
  } catch (e) { return fail(e); }
}

/** Marks one item as got (or needed again) straight from the list in the panel. */
export async function setItemDone(itemId: number, done: boolean): Promise<WlResult> {
  try {
    const staff = await requireStaff();
    const [i] = await db()<{ name: string }[]>`
      update wishlist_items set done = ${done}, done_at = ${done ? new Date() : null}
      where id = ${itemId} and school_id = ${staff.schoolId} returning name`;
    if (!i) return { error: "This item is no longer there. Reload the page." };
    refresh();
    return { ok: done ? `“${i.name}” marked as got. Families see it crossed out.` : `“${i.name}” is needed again.` };
  } catch (e) { return fail(e); }
}

/** Moves a list up or down among the lists of its own group. */
export async function moveWishlist(id: number, dir: -1 | 1): Promise<WlResult> {
  try {
    const staff = await requireStaff();
    let moved = false;
    await db().begin(async (tx) => {
      await tx`select 1 from wishlists where school_id = ${staff.schoolId} for update`;
      await tx`update wishlists w set sort_order = n.rn from (
        select id, row_number() over (order by sort_order, id) as rn from wishlists where school_id = ${staff.schoolId}) n
        where w.id = n.id`;
      const [c] = await tx<{ grp: string; sort_order: number }[]>`select grp, sort_order from wishlists where id = ${id} and school_id = ${staff.schoolId}`;
      if (!c) return;
      const [other] = dir < 0
        ? await tx<{ id: number; sort_order: number }[]>`select id, sort_order from wishlists where school_id = ${staff.schoolId} and grp = ${c.grp} and sort_order < ${c.sort_order} order by sort_order desc limit 1`
        : await tx<{ id: number; sort_order: number }[]>`select id, sort_order from wishlists where school_id = ${staff.schoolId} and grp = ${c.grp} and sort_order > ${c.sort_order} order by sort_order limit 1`;
      if (!other) return;
      await tx`update wishlists set sort_order = ${other.sort_order} where id = ${id}`;
      await tx`update wishlists set sort_order = ${c.sort_order} where id = ${other.id}`;
      moved = true;
    });
    refresh();
    return moved ? {} : { error: dir < 0 ? "It is already the first of its group." : "It is already the last of its group." };
  } catch (e) { return fail(e); }
}

export async function deleteWishlist(id: number): Promise<WlResult> {
  try {
    const staff = await requireStaff();
    const [w] = await db()<{ name: string }[]>`
      delete from wishlists w where w.id = ${id} and w.school_id = ${staff.schoolId}
      returning coalesce((select f.name from staff_favorites f where f.id = w.staff_id), w.name) as name`;
    if (!w) return { error: GONE };
    refresh();
    return { ok: `${w.name}’s list deleted, with its items.` };
  } catch (e) { return fail(e); }
}
