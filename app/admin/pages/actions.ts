"use server";
// Text pages of the signed-in user's school: draft, publish, versions, images.
// Every query is limited to that school; the browser never chooses it.
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "../../../lib/db";
import { storageSafeName } from "../../../lib/files";
import { cleanPageHtml } from "../../../lib/page-html";
import { requireStaff, type Staff } from "../../../lib/staff";
import { getStorage, storageConfigured } from "../../../lib/storage";

export type PageCopy = { title: string; summary: string; html: string };
export type PageResult = { error?: string; ok?: string; savedAt?: string; copy?: PageCopy };

const fail = (err: unknown, fallback: string): PageResult => ({ error: err instanceof Error ? err.message : fallback });
const author = (s: Staff) => s.name || s.email;

function clean(copy: PageCopy): PageCopy {
  const title = String(copy.title ?? "").replace(/\s+/g, " ").trim();
  const summary = String(copy.summary ?? "").replace(/\s+/g, " ").trim();
  if (!title) throw new Error("Enter the page title.");
  if (title.length > 120) throw new Error("The title is too long (120 characters at most).");
  if (summary.length > 300) throw new Error("The summary is too long (300 characters at most).");
  const html = cleanPageHtml(String(copy.html ?? ""));
  if (html.length > 2_000_000) throw new Error("The page is too long to save.");
  return { title, summary, html };
}

async function ownPage(staff: Staff, id: number) {
  const [p] = await db()<{ id: number; slug: string }[]>`select id, slug from pages where id = ${Number(id)} and school_id = ${staff.schoolId}`;
  if (!p) throw new Error("This page no longer exists.");
  return p;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "page";

export async function createPage(title: string): Promise<PageResult & { id?: number }> {
  try {
    const staff = await requireStaff();
    const copy = clean({ title, summary: "", html: "" });
    const sql = db();
    const taken = new Set((await sql<{ slug: string }[]>`select slug from pages where school_id = ${staff.schoolId}`).map((r) => r.slug));
    const base = slugify(copy.title);
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    const [p] = await sql<{ id: number }[]>`
      insert into pages (school_id, slug, draft_title) values (${staff.schoolId}, ${slug}, ${copy.title}) returning id`;
    await sql`insert into page_versions (page_id, kind, title, summary, html, author) values (${p.id}, 'draft', ${copy.title}, '', '', ${author(staff)})`;
    revalidatePath("/admin/pages");
    return { ok: "Page created.", id: p.id };
  } catch (err) {
    return fail(err, "Could not create the page.");
  }
}

async function writeDraft(staff: Staff, id: number, copy: PageCopy, kind: "draft" | "restored") {
  const sql = db();
  await sql`update pages set draft_title = ${copy.title}, draft_summary = ${copy.summary}, draft_html = ${copy.html}, updated_at = now()
    where id = ${id} and school_id = ${staff.schoolId}`;
  // Saving the same draft twice in a row does not add another version.
  const [last] = await sql<PageCopy[]>`select title, summary, html from page_versions where page_id = ${id} order by created_at desc, id desc limit 1`;
  if (!last || last.title !== copy.title || last.summary !== copy.summary || last.html !== copy.html || kind === "restored")
    await sql`insert into page_versions (page_id, kind, title, summary, html, author) values (${id}, ${kind}, ${copy.title}, ${copy.summary}, ${copy.html}, ${author(staff)})`;
}

export async function saveDraft(id: number, input: PageCopy): Promise<PageResult> {
  try {
    const staff = await requireStaff();
    const page = await ownPage(staff, id);
    const copy = clean(input);
    await writeDraft(staff, page.id, copy, "draft");
    revalidatePath("/admin/pages");
    return { ok: "Draft saved. Families still see the published version.", savedAt: new Date().toISOString(), copy };
  } catch (err) {
    return fail(err, "Could not save the draft.");
  }
}

export async function publishPage(id: number, input: PageCopy): Promise<PageResult> {
  try {
    const staff = await requireStaff();
    const page = await ownPage(staff, id);
    const copy = clean(input);
    await writeDraft(staff, page.id, copy, "draft");
    const sql = db();
    await sql`update pages set title = ${copy.title}, summary = ${copy.summary}, html = ${copy.html}, published_at = now(), updated_at = now()
      where id = ${page.id} and school_id = ${staff.schoolId}`;
    await sql`insert into page_versions (page_id, kind, title, summary, html, author) values (${page.id}, 'published', ${copy.title}, ${copy.summary}, ${copy.html}, ${author(staff)})`;
    revalidatePath("/admin/pages");
    revalidatePath(`/pages/${page.slug}`);
    return { ok: "Published. Families now see this version.", savedAt: new Date().toISOString(), copy };
  } catch (err) {
    return fail(err, "Could not publish the page.");
  }
}

// Puts an earlier version back in the draft. Families see it after "Publish".
export async function restoreVersion(id: number, versionId: number): Promise<PageResult> {
  try {
    const staff = await requireStaff();
    const page = await ownPage(staff, id);
    const [v] = await db()<PageCopy[]>`select title, summary, html from page_versions where id = ${Number(versionId)} and page_id = ${page.id}`;
    if (!v) return { error: "This version no longer exists." };
    await writeDraft(staff, page.id, v, "restored");
    revalidatePath("/admin/pages");
    return { ok: "That version is back in the draft. Press “Publish” to show it to families.", savedAt: new Date().toISOString(), copy: v };
  } catch (err) {
    return fail(err, "Could not restore that version.");
  }
}

export async function deletePage(id: number): Promise<PageResult> {
  try {
    const staff = await requireStaff();
    const [p] = await db()<{ legacy_path: string }[]>`select legacy_path from pages where id = ${Number(id)} and school_id = ${staff.schoolId}`;
    if (!p) return { error: "This page no longer exists." };
    if (p.legacy_path) return { error: "This page replaces one of the portal’s original pages, so it cannot be deleted." };
    await db()`delete from pages where id = ${Number(id)} and school_id = ${staff.schoolId}`;
    revalidatePath("/admin/pages");
    return { ok: "Page deleted." };
  } catch (err) {
    return fail(err, "Could not delete the page.");
  }
}

// ---- Images: the browser sends the file straight to storage ----
const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp"];
export async function startImageUpload(fileName: string, size: number): Promise<{ putUrl: string; src: string; contentType: string } | { error: string }> {
  try {
    const staff = await requireStaff();
    if (!storageConfigured()) return { error: "Image uploads are not set up yet." };
    const ext = (/\.([a-z0-9]{1,5})$/i.exec(fileName)?.[1] ?? "").toLowerCase();
    if (!IMAGE_EXT.includes(ext)) return { error: "Choose a PNG, JPG, GIF or WebP image." };
    if (!(size > 0)) return { error: "The image is empty." };
    if (size > 10 * 1024 * 1024) return { error: "The image is larger than 10 MB." };
    const key = `pages/${staff.schoolId}/${randomUUID()}/${storageSafeName(fileName)}`;
    const putUrl = await getStorage().signedPutUrl(key, 900);
    const contentType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    return { putUrl, src: `/files/${key.split("/").map(encodeURIComponent).join("/")}`, contentType };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not start the upload." };
  }
}
