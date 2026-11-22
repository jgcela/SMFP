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
    const [f] = await db()<{ name: string; before: FamilyStatus }[]>`
      with old as (select id, status from families where id = ${id} and school_id = ${staff.schoolId})
      update families f set status = ${status}, decided_at = now(), decided_by = ${staff.name || staff.email}
      from old where f.id = old.id
      returning f.name, old.status as before`;
    if (!f) return { error: "This family is no longer in the list. Reload the page." };
    // The family's accounts (none for a family created from FACTS until a parent accepts an invitation).
    const users = await db()<{ user_id: string; email: string }[]>`
      select fu.user_id, u.email from family_users fu join auth_user u on u.id = fu.user_id where fu.family_id = ${id}`;
    for (const u of users) {
      // Step 9: the family gets an email when it is approved or rejected (not when it was already).
      if (f.before !== status && status === "approved") await sendSchoolMail(staff.schoolId, "familyApproved", u.email, f.name);
      if (f.before !== status && status === "rejected") await sendSchoolMail(staff.schoolId, "familyRejected", u.email, f.name);
      // Anyone who is not approved loses any session they had.
      if (status !== "approved") await (await auth().$context).internalAdapter.deleteUserSessions(u.user_id);
    }
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
