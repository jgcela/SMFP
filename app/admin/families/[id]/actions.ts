"use server";
// The school keeps each family's children (name, grade, teacher, and optionally the
// FACTS Student ID that puts the child under FACTS access, lib/student-access.ts).
// Only families and children of this school.
import { revalidatePath } from "next/cache";
import { db } from "../../../../lib/db";
import { requireStaff } from "../../../../lib/staff";

export type ChildFix = { ok?: string; error?: string; field?: string };
const text = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().replace(/[ \t]+/g, " ").slice(0, max);
const fail = (e: unknown): ChildFix => ({ error: e instanceof Error ? e.message : "Something went wrong. Try again." });
const done = (familyId: number) => { revalidatePath(`/admin/families/${familyId}`); revalidatePath("/family"); };

export async function saveChild(fd: FormData): Promise<ChildFix> {
  try {
    const staff = await requireStaff();
    const id = Number(fd.get("id") || 0);
    const familyId = Number(fd.get("family_id") || 0);
    const name = text(fd, "name", 100);
    const grade = text(fd, "grade", 40);
    const teacher = text(fd, "teacher", 100);
    if (!name) return { error: "Write the child's name.", field: "name" };
    if (!grade) return { error: "Write the grade (for example: 3rd grade).", field: "grade" };
    const factsId = text(fd, "facts_id", 65) || null;
    if (factsId && (factsId.length > 64 || /\s/.test(factsId))) return { error: "The FACTS Student ID is a code without spaces (at most 64 characters).", field: "facts_id" };
    if (factsId) {
      const [other] = await db()<{ name: string }[]>`select name from children where school_id = ${staff.schoolId} and facts_id = ${factsId} and id <> ${id}`;
      if (other) return { error: `Another child (${other.name}) already has this FACTS Student ID.`, field: "facts_id" };
    }
    const by = staff.name || staff.email;
    if (id) {
      const [c] = await db()<{ family_id: number }[]>`
        update children set name = ${name}, grade = ${grade}, teacher = ${teacher}, facts_id = ${factsId}, updated_at = now(), updated_by = ${by}
        where id = ${id} and school_id = ${staff.schoolId} returning family_id`;
      if (!c) return { error: "This child is no longer on the list. Reload the page." };
      done(c.family_id);
      return { ok: `${name}: saved.` };
    }
    const [f] = await db()<{ id: number; n: number }[]>`
      select f.id, (select count(*)::int from children c where c.family_id = f.id) as n
      from families f where f.id = ${familyId} and f.school_id = ${staff.schoolId}`;
    if (!f) return { error: "This family is no longer in the list. Reload the page." };
    if (f.n >= 15) return { error: "A family can have at most 15 children on the list." };
    await db()`insert into children (school_id, family_id, name, grade, teacher, facts_id, updated_by) values (${staff.schoolId}, ${f.id}, ${name}, ${grade}, ${teacher}, ${factsId}, ${by})`;
    done(f.id);
    return { ok: `${name} added. The family sees it now.` };
  } catch (e) { return fail(e); }
}

export async function removeChild(id: number): Promise<ChildFix> {
  try {
    const staff = await requireStaff();
    const [c] = await db()<{ name: string; family_id: number }[]>`
      delete from children where id = ${id} and school_id = ${staff.schoolId} returning name, family_id`;
    if (!c) return { error: "This child is no longer on the list. Reload the page." };
    done(c.family_id);
    return { ok: `${c.name} removed. Past absences stay in the list.` };
  } catch (e) { return fail(e); }
}
