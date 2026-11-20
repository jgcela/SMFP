"use server";
// Staff manage the school's Staff favorites cards (step 6c). Only rows of this school.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "../../../lib/db";
import { detectFileKind, storageSafeName } from "../../../lib/files";
import { requireStaff } from "../../../lib/staff";
import { PHOTO_ACCEPT, PHOTO_MAX_BYTES, readStaffCard } from "../../../lib/staff-favorites";
import { loadStaffPage } from "../../../lib/staff-favorites-db";
import { getStorage } from "../../../lib/storage";
import { readUpload, signUpload } from "../../../lib/upload-token";

export type SfResult = { ok?: string; error?: string; field?: string };
const fail = (e: unknown): SfResult => ({ error: e instanceof Error ? e.message : "Something went wrong. Try again." });
const refresh = () => { revalidatePath("/admin/staff-favorites"); };
const GONE = "This card is no longer in the list. Reload the page.";

async function removeFile(key: string | null | undefined) {
  if (!key) return;
  try { await getStorage().delete(key); } catch { /* an orphan photo is harmless */ }
}

/** The browser sends the photo straight to private storage. */
export async function startPhotoUpload(fileName: string, size: number): Promise<{ token: string; putUrl: string } | { error: string }> {
  try {
    const staff = await requireStaff();
    const ext = (/\.([a-z0-9]{1,5})$/i.exec(fileName)?.[1] ?? "").toLowerCase();
    if (!PHOTO_ACCEPT.split(",").includes(`.${ext}`)) return { error: "Choose a photo in PNG, JPG, GIF or WebP." };
    if (!(size > 0)) return { error: "The photo is empty." };
    if (size > PHOTO_MAX_BYTES) return { error: "The photo is larger than 5 MB." };
    const key = `staff/${staff.schoolId}/${randomUUID()}/${storageSafeName(fileName)}`;
    const putUrl = await getStorage().signedPutUrl(key, 900);
    return { token: signUpload({ k: key, s: staff.schoolId, n: fileName.slice(0, 200), e: Math.floor(Date.now() / 1000) + 3600 }), putUrl };
  } catch (e) { return fail(e) as { error: string }; }
}

export async function saveStaffCard(fd: FormData): Promise<SfResult> {
  let newKey: string | null = null;
  try {
    const staff = await requireStaff();
    const id = Number(fd.get("id") || 0);
    const { teams } = await loadStaffPage(staff.schoolId);
    const r = readStaffCard(fd, teams);
    if (!r.value) return { error: r.error, field: r.field };
    const v = r.value;
    const sql = db();
    const [cur] = id ? await sql<{ photo_key: string | null }[]>`select photo_key from staff_favorites where id = ${id} and school_id = ${staff.schoolId}` : [];
    if (id && !cur) return { error: GONE };

    let photo: string | null | undefined; // undefined = keep the current one
    const token = String(fd.get("photo_token") ?? "");
    if (token) {
      const up = readUpload(token, staff.schoolId, "staff");
      if (!up) return { error: "The photo upload expired. Choose the photo again.", field: "photo" };
      newKey = up.key;
      const obj = await getStorage().peek(up.key, 4096);
      if (!obj) return { error: "The photo did not reach storage. Try again.", field: "photo" };
      if (obj.size > PHOTO_MAX_BYTES) return { error: "The photo is larger than 5 MB.", field: "photo" };
      const kind = detectFileKind(up.name, obj.head);
      if (!kind.ok || !kind.kind.contentType.startsWith("image/")) return { error: "This file is not a photo. Choose a PNG, JPG, GIF or WebP.", field: "photo" };
      photo = up.key;
    } else if (fd.get("remove_photo") === "on") photo = null;

    const cols = {
      team: v.team, name: v.name, role: v.role, favorites: sql.json(v.favorites), wishlist_href: v.wishlistHref, hidden: v.hidden,
      updated_by: staff.name || staff.email, ...(photo !== undefined ? { photo_key: photo } : {}),
    };
    if (id) {
      const u = await sql`update staff_favorites set ${sql(cols)}, updated_at = now() where id = ${id} and school_id = ${staff.schoolId}`;
      if (!u.count) return { error: GONE };
    } else {
      const [n] = await sql<{ id: number }[]>`insert into staff_favorites ${sql({ ...cols, school_id: staff.schoolId })} returning id`;
      await sql`update staff_favorites set sort_order = (select coalesce(max(sort_order), 0) + 1 from staff_favorites where school_id = ${staff.schoolId})
        where id = ${n.id}`;
    }
    newKey = null; // saved: keep it
    if (photo !== undefined && cur?.photo_key && cur.photo_key !== photo) await removeFile(cur.photo_key);
    refresh();
    const where = v.hidden ? " (hidden)" : v.favorites.length ? "" : ". It shows in “Still to share their favorites” until it has favorites";
    return { ok: id ? `${v.name} saved${where}.` : `${v.name} added${where}.` };
  } catch (e) {
    return fail(e);
  } finally {
    if (newKey) await removeFile(newKey); // uploaded but refused or not saved
  }
}

export async function setStaffHidden(id: number, hidden: boolean): Promise<SfResult> {
  try {
    const staff = await requireStaff();
    const [c] = await db()<{ name: string }[]>`
      update staff_favorites set hidden = ${hidden}, updated_at = now(), updated_by = ${staff.name || staff.email}
      where id = ${id} and school_id = ${staff.schoolId} returning name`;
    if (!c) return { error: GONE };
    refresh();
    return { ok: hidden ? `${c.name} is hidden. Families no longer see this card.` : `${c.name} is visible again.` };
  } catch (e) { return fail(e); }
}

/** Moves a card up or down among the cards of its own group. */
export async function moveStaffCard(id: number, dir: -1 | 1): Promise<SfResult> {
  try {
    const staff = await requireStaff();
    let moved = false;
    await db().begin(async (tx) => {
      await tx`select 1 from staff_favorites where school_id = ${staff.schoolId} for update`;
      // Number them 1, 2, 3… first, so two cards never share a place.
      await tx`update staff_favorites f set sort_order = n.rn from (
        select id, row_number() over (order by sort_order, id) as rn from staff_favorites where school_id = ${staff.schoolId}) n
        where f.id = n.id`;
      const [c] = await tx<{ team: string; sort_order: number }[]>`select team, sort_order from staff_favorites where id = ${id} and school_id = ${staff.schoolId}`;
      if (!c) return;
      const [other] = dir < 0
        ? await tx<{ id: number; sort_order: number }[]>`select id, sort_order from staff_favorites where school_id = ${staff.schoolId} and team = ${c.team} and sort_order < ${c.sort_order} order by sort_order desc limit 1`
        : await tx<{ id: number; sort_order: number }[]>`select id, sort_order from staff_favorites where school_id = ${staff.schoolId} and team = ${c.team} and sort_order > ${c.sort_order} order by sort_order limit 1`;
      if (!other) return;
      await tx`update staff_favorites set sort_order = ${other.sort_order} where id = ${id}`;
      await tx`update staff_favorites set sort_order = ${c.sort_order} where id = ${other.id}`;
      moved = true;
    });
    refresh();
    return moved ? {} : { error: dir < 0 ? "It is already the first of its group." : "It is already the last of its group." };
  } catch (e) { return fail(e); }
}

export async function deleteStaffCard(id: number): Promise<SfResult> {
  try {
    const staff = await requireStaff();
    const [c] = await db()<{ name: string; photo_key: string | null }[]>`
      delete from staff_favorites where id = ${id} and school_id = ${staff.schoolId} returning name, photo_key`;
    if (!c) return { error: GONE };
    await removeFile(c.photo_key);
    refresh();
    return { ok: `${c.name} deleted.` };
  } catch (e) { return fail(e); }
}
