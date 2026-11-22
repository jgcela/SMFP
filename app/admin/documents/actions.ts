"use server";
// Family documents: categories and documents of the signed-in user's school.
// Every query is limited to that school; the browser never chooses it.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "../../../lib/db";
import { ACCEPT_ATTR, ALLOWED_DESCRIPTION, MAX_FILE_BYTES, detectFileKind, fileMeta, sanitizeFileName, storageSafeName } from "../../../lib/files";
import { requireYearStaff } from "../../../lib/staff";
import { getStorage } from "../../../lib/storage";
import { readUpload, signUpload } from "../../../lib/upload-token";

export type DocState = { error?: string; ok?: string } | undefined;



function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/documents");
}
const fail = (err: unknown, fallback: string) => ({ error: err instanceof Error ? err.message : fallback });

// ---- Uploads: the browser sends the file straight to storage ----
export async function startUpload(fileName: string, size: number): Promise<{ token: string; putUrl: string } | { error: string }> {
  try {
    const staff = await requireYearStaff();
    if (!(size > 0)) return { error: "The file is empty." };
    if (size > MAX_FILE_BYTES) return { error: "The file is larger than 25 MB." };
    const ext = (/\.([a-z0-9]{1,5})$/i.exec(fileName)?.[1] ?? "").toLowerCase();
    if (!ACCEPT_ATTR.split(",").includes(`.${ext}`)) return { error: `This file type is not allowed. Upload ${ALLOWED_DESCRIPTION}.` };
    const key = `documents/${staff.schoolId}/${randomUUID()}/${storageSafeName(fileName)}`;
    const putUrl = await getStorage().signedPutUrl(key, 900);
    const token = signUpload({ k: key, s: staff.schoolId, n: fileName.slice(0, 200), e: Math.floor(Date.now() / 1000) + 3600 });
    return { token, putUrl };
  } catch (err) {
    return fail(err, "Could not start the upload.");
  }
}

async function removeFile(key: string | null | undefined) {
  if (!key) return;
  // A copied school year shares its files with the year it came from (step 11a).
  const [used] = await db()`select 1 from documents where file_key = ${key} limit 1`;
  if (used) return;
  try {
    await getStorage().delete(key);
  } catch {
    // An orphan file is harmless; the document row is what the portal uses.
  }
}

// ---- Documents ----
const isUrl = (s: string) => /^https?:\/\/[^\s]+$/i.test(s);
const isPortalPath = (s: string) => /^\/?[\w\-./%]+(\.html?)?(#[\w-]*)?$/i.test(s) && !s.startsWith("//");

export async function saveDocument(_prev: DocState, fd: FormData): Promise<DocState> {
  let newKey: string | null = null;
  try {
    const staff = await requireYearStaff();
    const sql = db();
    const id = Number(fd.get("id") ?? 0) || null;
    const title = String(fd.get("title") ?? "").trim();
    const categoryId = Number(fd.get("category_id") ?? 0);
    const description = String(fd.get("description") ?? "").trim();
    const mostUsed = fd.get("most_used") === "on";
    const source = String(fd.get("source") ?? "");
    const link = String(fd.get("link") ?? "").trim();
    const token = String(fd.get("upload_token") ?? "");

    if (!title) return { error: "Write a title." };
    if (title.length > 150) return { error: "The title can be at most 150 characters." };
    if (description.length > 80) return { error: "The short description can be at most 80 characters." };
    const [cat] = await sql<{ id: number }[]>`select id from document_categories where id = ${categoryId} and school_id = ${staff.schoolId} and year_id = ${staff.yearId}`;
    if (!cat) return { error: "Choose a category." };

    const [cur] = id
      ? await sql<{ category_id: number; file_key: string | null; most_used_rank: number | null }[]>`
          select category_id, file_key, most_used_rank from documents where id = ${id} and school_id = ${staff.schoolId} and year_id = ${staff.yearId}`
      : [];
    if (id && !cur) return { error: "This document no longer exists. Reload the page." };

    // What the document points to.
    let target: { href: string; meta: string; kind: string; file?: { key: string; name: string; type: string; size: number } } | null = null;
    if (source === "link") {
      if (!link) return { error: "Paste the link (it starts with https://)." };
      if (link.length > 1000) return { error: "The link is too long." };
      if (isUrl(link)) target = { href: link, meta: "External site", kind: "ext" };
      else if (isPortalPath(link)) target = { href: link.replace(/^\//, ""), meta: "Web page", kind: "web" };
      else return { error: "The link must start with https://" };
    } else if (source === "file") {
      if (token) {
        const up = readUpload(token, staff.schoolId);
        if (!up) return { error: "The upload expired. Choose the file again." };
        newKey = up.key;
        const obj = await getStorage().peek(up.key, 4096);
        if (!obj) return { error: "The file did not reach storage. Try again." };
        if (obj.size > MAX_FILE_BYTES) return { error: "The file is larger than 25 MB." };
        const kind = detectFileKind(up.name, obj.head);
        if (!kind.ok) return { error: kind.error };
        const name = sanitizeFileName(up.name, kind.kind);
        target = { href: "", meta: fileMeta(kind.kind, obj.size), kind: "file", file: { key: up.key, name, type: kind.kind.contentType, size: obj.size } };
      } else if (!id) return { error: "Choose a file to upload." };
      // Editing without a new file: keep the current one.
    } else return { error: "Choose a file or a link." };

    const moved = !id || cur!.category_id !== categoryId;
    let docId = id;
    await sql.begin(async (tx) => {
      const [{ next }] = await tx<{ next: number }[]>`
        select coalesce(max(sort_order), -1) + 1 as next from documents where school_id = ${staff.schoolId} and year_id = ${staff.yearId} and category_id = ${categoryId}`;
      const [{ rank }] = await tx<{ rank: number }[]>`
        select coalesce(max(most_used_rank), 0) + 1 as rank from documents where school_id = ${staff.schoolId} and year_id = ${staff.yearId}`;
      const mostRank = mostUsed ? (cur?.most_used_rank ?? rank) : null;
      if (!docId) {
        const [row] = await tx<{ id: number }[]>`
          insert into documents (school_id, year_id, category_id, title, description, href, meta, kind, added_on, sort_order, most_used_rank)
          values (${staff.schoolId}, ${staff.yearId}, ${categoryId}, ${title}, ${description}, ${target?.href ?? ""}, ${target?.meta ?? ""},
            ${target?.kind ?? "file"}, current_date, ${next}, ${mostRank})
          returning id`;
        docId = row.id;
      } else {
        await tx`
          update documents set title = ${title}, description = ${description}, category_id = ${categoryId}, review_from = null,
            most_used_rank = ${mostRank}, sort_order = ${moved ? next : tx`sort_order`}
          where id = ${docId} and school_id = ${staff.schoolId} and year_id = ${staff.yearId}`;
      }
      if (target) {
        const f = target.file;
        await tx`
          update documents set
            href = ${f ? `doc/${docId}` : target.href}, meta = ${target.meta}, kind = ${target.kind},
            file_key = ${f?.key ?? null}, file_name = ${f?.name ?? null}, content_type = ${f?.type ?? null}, file_size = ${f?.size ?? null}
          where id = ${docId} and school_id = ${staff.schoolId} and year_id = ${staff.yearId}`;
      }
    });
    newKey = null; // saved: keep it
    if (target && cur?.file_key && cur.file_key !== target.file?.key) await removeFile(cur.file_key);
    refresh();
    return { ok: id ? "Document saved." : "Document added." };
  } catch (err) {
    return fail(err, "Could not save. Try again.");
  } finally {
    if (newKey) await removeFile(newKey); // uploaded but refused or not saved
  }
}

/** A document copied from last year that is still right: remove the "check it" mark. */
export async function markUpToDate(id: number | "all"): Promise<DocState> {
  try {
    const staff = await requireYearStaff();
    const rows = await db()`
      update documents set review_from = null
      where school_id = ${staff.schoolId} and year_id = ${staff.yearId} and review_from is not null
        ${id === "all" ? db()`` : db()`and id = ${Number(id)}`}
      returning id`;
    refresh();
    return { ok: rows.length === 1 ? "Marked as up to date." : `${rows.length} documents marked as up to date.` };
  } catch (err) {
    return fail(err, "Could not save. Try again.");
  }
}

export async function deleteDocument(id: number): Promise<DocState> {
  try {
    const staff = await requireYearStaff();
    const [row] = await db()<{ file_key: string | null }[]>`
      delete from documents where id = ${Number(id)} and school_id = ${staff.schoolId} and year_id = ${staff.yearId} returning file_key`;
    if (!row) return { error: "This document no longer exists." };
    await removeFile(row.file_key);
    refresh();
    return { ok: "Document deleted." };
  } catch (err) {
    return fail(err, "Could not delete. Try again.");
  }
}

/** Moves a document one place up or down inside its category. */
export async function moveDocument(id: number, dir: -1 | 1): Promise<DocState> {
  try {
    const staff = await requireYearStaff();
    await db().begin(async (tx) => {
      const [d] = await tx<{ category_id: number }[]>`
        select category_id from documents where id = ${Number(id)} and school_id = ${staff.schoolId} and year_id = ${staff.yearId} for update`;
      if (!d) throw new Error("This document no longer exists.");
      const list = await tx<{ id: number }[]>`
        select id from documents where school_id = ${staff.schoolId} and year_id = ${staff.yearId} and category_id = ${d.category_id}
        order by sort_order, id for update`;
      const ids = list.map((x) => x.id);
      const i = ids.indexOf(Number(id));
      const j = i + dir;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      for (let n = 0; n < ids.length; n++) await tx`update documents set sort_order = ${n} where id = ${ids[n]}`;
    });
    refresh();
    return { ok: "Order saved." };
  } catch (err) {
    return fail(err, "Could not change the order.");
  }
}

// ---- Categories ----
function slug(name: string) {
  return name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "category";
}

export async function saveCategory(_prev: DocState, fd: FormData): Promise<DocState> {
  try {
    const staff = await requireYearStaff();
    const id = Number(fd.get("id") ?? 0) || null;
    const name = String(fd.get("name") ?? "").trim();
    const description = String(fd.get("description") ?? "").trim();
    if (!name) return { error: "Write the category name." };
    if (name.length > 60) return { error: "The name can be at most 60 characters." };
    if (description.length > 160) return { error: "The description can be at most 160 characters." };
    if (id) {
      const r = await db()`update document_categories set name = ${name}, description = ${description}
        where id = ${id} and school_id = ${staff.schoolId} and year_id = ${staff.yearId}`;
      if (!r.count) return { error: "This category no longer exists." };
    } else {
      // The key appears in portal links (#cat-forms); it never changes after creation.
      const base = slug(name);
      const taken = new Set((await db()<{ key: string }[]>`select key from document_categories where school_id = ${staff.schoolId} and year_id = ${staff.yearId}`).map((x) => x.key));
      let key = base;
      for (let n = 2; taken.has(key); n++) key = `${base}-${n}`;
      await db()`
        insert into document_categories (school_id, year_id, key, name, description, sort_order)
        values (${staff.schoolId}, ${staff.yearId}, ${key}, ${name}, ${description},
          (select coalesce(max(sort_order), -1) + 1 from document_categories where school_id = ${staff.schoolId} and year_id = ${staff.yearId}))`;
    }
    refresh();
    return { ok: id ? "Category saved." : "Category added." };
  } catch (err) {
    return fail(err, "Could not save. Try again.");
  }
}

export async function moveCategory(id: number, dir: -1 | 1): Promise<DocState> {
  try {
    const staff = await requireYearStaff();
    await db().begin(async (tx) => {
      const list = await tx<{ id: number }[]>`
        select id from document_categories where school_id = ${staff.schoolId} and year_id = ${staff.yearId} order by sort_order, id for update`;
      const ids = list.map((x) => x.id);
      const i = ids.indexOf(Number(id));
      if (i < 0) throw new Error("This category no longer exists.");
      const j = i + dir;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      for (let n = 0; n < ids.length; n++) await tx`update document_categories set sort_order = ${n} where id = ${ids[n]}`;
    });
    refresh();
    return { ok: "Order saved." };
  } catch (err) {
    return fail(err, "Could not change the order.");
  }
}

export async function deleteCategory(id: number): Promise<DocState> {
  try {
    const staff = await requireYearStaff();
    const [{ n }] = await db()<{ n: number }[]>`
      select count(*)::int as n from documents where category_id = ${Number(id)} and school_id = ${staff.schoolId} and year_id = ${staff.yearId}`;
    if (n > 0) return { error: "Move or delete its documents first." };
    const r = await db()`delete from document_categories where id = ${Number(id)} and school_id = ${staff.schoolId} and year_id = ${staff.yearId}`;
    if (!r.count) return { error: "This category no longer exists." };
    refresh();
    return { ok: "Category deleted." };
  } catch (err) {
    return fail(err, "Could not delete. Try again.");
  }
}
