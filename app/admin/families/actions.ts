"use server";
// Approving families and changing the school code. Only staff of this school,
// and only families of this school (checked in every query).
import { revalidatePath } from "next/cache";
import { auth } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { newFamilyCode, type FamilyStatus } from "../../../lib/family";
import { requireStaff } from "../../../lib/staff";

export type FamilyResult = { ok?: string; error?: string; code?: string };

const DONE: Record<FamilyStatus, string> = {
  approved: "approved. They can sign in now.",
  rejected: "rejected. They cannot sign in.",
  disabled: "turned off. They have been signed out and cannot sign in.",
  pending: "moved back to pending.",
};

export async function setFamilyStatus(id: number, status: FamilyStatus): Promise<FamilyResult> {
  try {
    const staff = await requireStaff();
    if (!Number.isInteger(id) || !["approved", "rejected", "disabled"].includes(status)) return { error: "That change is not possible." };
    const [f] = await db()<{ user_id: string; name: string }[]>`
      update families set status = ${status}, decided_at = now(), decided_by = ${staff.name || staff.email}
      where id = ${id} and school_id = ${staff.schoolId}
      returning user_id, name`;
    if (!f) return { error: "This family is no longer in the list. Reload the page." };
    // Anyone who is not approved loses any session they had.
    if (status !== "approved") await (await auth().$context).internalAdapter.deleteUserSessions(f.user_id);
    revalidatePath("/admin/families");
    return { ok: `${f.name}: ${DONE[status]}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong. Try again." };
  }
}

export async function changeFamilyCode(): Promise<FamilyResult> {
  try {
    const staff = await requireStaff();
    const code = newFamilyCode();
    await db()`update schools set family_code = ${code} where id = ${staff.schoolId}`;
    revalidatePath("/admin/families");
    return { ok: "New code saved. The old code no longer works; families already registered are not affected.", code };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong. Try again." };
  }
}
