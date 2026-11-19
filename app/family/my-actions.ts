"use server";
// What an approved family can do on "My family". Every action reads the family
// from the session (currentFamily) and only touches rows of that family.
// Children are added by the school (later they will come from FACTS), not here.
import { revalidatePath } from "next/cache";
import { checkPhone } from "../../lib/contact";
import { db } from "../../lib/db";
import { currentFamily, type Family } from "../../lib/family";
import { ABSENCE_REASONS, checkDate, checkRange, REQUEST_TYPES } from "../../lib/my-family";

export type MyResult = { ok?: string; error?: string; field?: string };

async function family(): Promise<Family> {
  const f = await currentFamily();
  if (!f) throw new Error("Your session has ended or your account is not active. Sign in again.");
  return f;
}
const text = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().replace(/[ \t]+/g, " ").slice(0, max);
const fail = (e: unknown): MyResult => ({ error: e instanceof Error ? e.message : "Something went wrong. Try again." });

export async function saveFamilyDetails(fd: FormData): Promise<MyResult> {
  try {
    const f = await family();
    const parents = text(fd, "parent_names", 200);
    const phone = text(fd, "phone", 40);
    const c2name = text(fd, "contact2_name", 100);
    const c2phone = text(fd, "contact2_phone", 40);
    const c2rel = text(fd, "contact2_relation", 60);
    if (!parents) return { error: "Write the parents' names.", field: "parent_names" };
    const p = checkPhone(phone);
    if (p) return { error: p, field: "phone" };
    if (c2name || c2phone || c2rel) {
      if (!c2name) return { error: "Write the name of the second adult, or leave the three fields empty.", field: "contact2_name" };
      const p2 = checkPhone(c2phone);
      if (p2) return { error: `Second adult: ${p2}`, field: "contact2_phone" };
    }
    await db()`
      update families set parent_names = ${parents}, phone = ${phone},
        contact2_name = ${c2name}, contact2_phone = ${c2phone}, contact2_relation = ${c2rel}
      where id = ${f.id}`;
    revalidatePath("/family");
    return { ok: "Family details saved." };
  } catch (e) { return fail(e); }
}

export async function reportAbsence(fd: FormData): Promise<MyResult> {
  try {
    const f = await family();
    const childId = Number(fd.get("child_id") || 0);
    const from = String(fd.get("date_from") ?? "");
    const to = String(fd.get("date_to") || from);
    const reason = String(fd.get("reason") ?? "");
    const note = text(fd, "note", 1000);
    const [child] = await db()<{ name: string }[]>`select name from children where id = ${childId} and family_id = ${f.id}`;
    if (!child) return { error: "Choose which child will be absent.", field: "child_id" };
    const e = checkRange(from, to);
    if (e) return { error: e, field: "date_from" };
    if (!(reason in ABSENCE_REASONS)) return { error: "Choose the reason.", field: "reason" };
    if (reason === "other" && !note) return { error: "Add a short note to explain the reason.", field: "note" };
    await db()`
      insert into family_submissions (school_id, family_id, child_id, child_name, kind, category, date_from, date_to, message)
      values (${f.schoolId}, ${f.id}, ${childId}, ${child.name}, 'absence', ${reason}, ${from}, ${to}, ${note})`;
    revalidatePath("/family");
    return { ok: `Absence sent for ${child.name}. The school will see it in its list.` };
  } catch (e) { return fail(e); }
}

export async function makeRequest(fd: FormData): Promise<MyResult> {
  try {
    const f = await family();
    const type = String(fd.get("type") ?? "");
    const date = String(fd.get("date") ?? "");
    const childId = Number(fd.get("child_id") || 0);
    const message = text(fd, "message", 1000);
    if (!(type in REQUEST_TYPES)) return { error: "Choose the type of request.", field: "type" };
    const e = checkDate(date, "the date");
    if (e) return { error: e, field: "date" };
    if (!message) return { error: "Write the message for the school.", field: "message" };
    let childName = "";
    if (childId) {
      const [c] = await db()<{ name: string }[]>`select name from children where id = ${childId} and family_id = ${f.id}`;
      if (!c) return { error: "Choose a child from your list, or “Whole family”.", field: "child_id" };
      childName = c.name;
    }
    await db()`
      insert into family_submissions (school_id, family_id, child_id, child_name, kind, category, date_from, date_to, message)
      values (${f.schoolId}, ${f.id}, ${childId || null}, ${childName}, 'request', ${type}, ${date}, ${date}, ${message})`;
    revalidatePath("/family");
    return { ok: "Request sent. You can follow its status below." };
  } catch (e) { return fail(e); }
}
