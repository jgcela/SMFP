"use server";
// Staff change the status of what families send. Only rows of this school.
import { revalidatePath } from "next/cache";
import { db } from "../../../lib/db";
import { STATUS_LABEL, type SubmissionStatus } from "../../../lib/my-family";
import { requireStaff } from "../../../lib/staff";

export type StatusResult = { ok?: string; error?: string };

export async function setSubmissionStatus(id: number, status: SubmissionStatus): Promise<StatusResult> {
  try {
    const staff = await requireStaff();
    if (!Number.isInteger(id) || !(status in STATUS_LABEL)) return { error: "That change is not possible." };
    const [r] = await db()<{ id: number }[]>`
      update family_submissions set status = ${status}, status_at = now(), status_by = ${staff.name || staff.email}
      where id = ${id} and school_id = ${staff.schoolId}
      returning id`;
    if (!r) return { error: "This item is no longer in the list. Reload the page." };
    revalidatePath("/admin/requests");
    revalidatePath("/family");
    return { ok: `Marked as “${STATUS_LABEL[status]}”. The family sees it now.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong. Try again." };
  }
}
