"use server";
// Staff settings (step 9): where the school receives "new family" emails.
import { revalidatePath } from "next/cache";
import { db } from "../../../lib/db";
import { isEmail } from "../../../lib/mail";
import { audit } from "../../../lib/platform";
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

// Step 10: the school lets FAMITENLY support into this staff panel for a limited
// time, or stops it. Only the school's own staff can do this (not support itself).
export async function setSupportAccess(_prev: AccountState, fd: FormData): Promise<AccountState> {
  try {
    const staff = await requireStaff();
    if (staff.support) return { error: "Only the school’s own staff can change support access." };
    const hours = Number(fd.get("hours"));
    if (hours === 0) {
      await db()`update schools set support_until = null, support_granted_by = null where id = ${staff.schoolId}`;
      await db()`delete from platform_support where school_id = ${staff.schoolId}`;
      await audit({ userId: staff.userId, email: staff.email }, "support.revoked", staff.schoolId, "The school turned off support access");
      revalidatePath("/admin/settings");
      return { ok: "Support access is off. Any support visit has ended." };
    }
    if (![1, 4, 24, 72].includes(hours)) return { error: "Pick how long." };
    await db()`update schools set support_until = now() + make_interval(hours => ${hours}), support_granted_by = ${staff.userId} where id = ${staff.schoolId}`;
    await audit({ userId: staff.userId, email: staff.email }, "support.allowed", staff.schoolId, `The school allowed support access for ${hours} hour${hours === 1 ? "" : "s"}`);
    revalidatePath("/admin/settings");
    return { ok: `FAMITENLY support can enter this panel for the next ${hours} hour${hours === 1 ? "" : "s"}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong. Try again." };
  }
}
