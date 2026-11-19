"use server";
// The school corrects a family's children (name, grade, teacher). Only children of
// families of this school.
import { revalidatePath } from "next/cache";
import { db } from "../../../../lib/db";
import { requireStaff } from "../../../../lib/staff";

export type ChildFix = { ok?: string; error?: string; field?: string };
const text = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().replace(/[ \t]+/g, " ").slice(0, max);

export async function correctChild(fd: FormData): Promise<ChildFix> {
  try {
    const staff = await requireStaff();
    const id = Number(fd.get("id") || 0);
    const name = text(fd, "name", 100);
    const grade = text(fd, "grade", 40);
    const teacher = text(fd, "teacher", 100);
    if (!name) return { error: "Write the child's name.", field: "name" };
    if (!grade) return { error: "Write the grade.", field: "grade" };
    const [c] = await db()<{ family_id: number }[]>`
      update children set name = ${name}, grade = ${grade}, teacher = ${teacher}, updated_at = now(), updated_by = ${staff.name || staff.email}
      where id = ${id} and school_id = ${staff.schoolId}
      returning family_id`;
    if (!c) return { error: "This child is no longer on the list. Reload the page." };
    revalidatePath(`/admin/families/${c.family_id}`);
    revalidatePath("/family");
    return { ok: `${name}: saved. The family sees the change.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong. Try again." };
  }
}
