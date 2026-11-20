"use server";
// Staff settings (step 9): where the school receives "new family" emails.
import { revalidatePath } from "next/cache";
import { db } from "../../../lib/db";
import { isEmail } from "../../../lib/mail";
import { requireStaff } from "../../../lib/staff";
import type { AccountState } from "../../account/actions";

export async function saveNotifyEmail(_prev: AccountState, fd: FormData): Promise<AccountState> {
  try {
    const staff = await requireStaff();
    const email = String(fd.get("notify_email") ?? "").trim().toLowerCase();
    if (email && !isEmail(email)) return { error: "Check the email: it should look like office@school.org.", field: "notify_email" };
    await db()`update schools set notify_email = ${email} where id = ${staff.schoolId}`;
    revalidatePath("/admin/settings");
    return { ok: email ? `Saved. New families waiting for approval will be emailed to ${email}.` : "Saved. No email will be sent when a new family registers." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong. Try again." };
  }
}
