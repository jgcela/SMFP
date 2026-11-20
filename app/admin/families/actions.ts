"use server";
// Approving families and changing the school code. Only staff of this school,
// and only families of this school (checked in every query).
import { revalidatePath } from "next/cache";
import { auth } from "../../../lib/auth";
import { db } from "../../../lib/db";
import { sendSchoolMail } from "../../../lib/emails";
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
    const [f] = await db()<{ user_id: string; name: string; before: FamilyStatus; email: string }[]>`
      with old as (select id, status from families where id = ${id} and school_id = ${staff.schoolId})
      update families f set status = ${status}, decided_at = now(), decided_by = ${staff.name || staff.email}
      from old, auth_user u
      where f.id = old.id and u.id = f.user_id
      returning f.user_id, f.name, old.status as before, u.email`;
    if (!f) return { error: "This family is no longer in the list. Reload the page." };
    // Step 9: the family gets an email when it is approved or rejected (not when it was already).
    if (f.before !== status && status === "approved") await sendSchoolMail(staff.schoolId, "familyApproved", f.email, f.name);
    if (f.before !== status && status === "rejected") await sendSchoolMail(staff.schoolId, "familyRejected", f.email, f.name);
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
