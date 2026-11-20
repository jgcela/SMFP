"use server";
// Step 9: things every account can do by email, for staff and families alike:
// reset a forgotten password and change the account's email. Both send a link
// that works once, for 1 hour (lib/email-links.ts). The school always comes
// from this deployment (PORTAL_SCHOOL), never from the browser.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { db } from "../../lib/db";
import { claimLink, createLink } from "../../lib/email-links";
import { portalOrigin, sendSchoolMail } from "../../lib/emails";
import { currentFamily } from "../../lib/family";
import { isEmail } from "../../lib/mail";
import { schoolSlug, schoolPath } from "../../lib/portal";
import { currentStaff, recordFailure, tooManyFailures } from "../../lib/staff";

export type AccountState = { ok?: string; error?: string; field?: string } | undefined;

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

/** Whether a user is staff or a family of THIS school (families in any status). */
async function accountOf(userId: string): Promise<{ kind: "staff" | "family"; schoolId: number } | null> {
  const [r] = await db()<{ staff: boolean; family: boolean; school_id: number }[]>`
    select s.id as school_id,
      exists (select 1 from school_staff ss where ss.user_id = ${userId} and ss.school_id = s.id) as staff,
      exists (select 1 from families f where f.user_id = ${userId} and f.school_id = s.id) as family
    from schools s where s.slug = ${await schoolSlug()}`;
  if (!r) return null;
  if (r.staff) return { kind: "staff", schoolId: r.school_id };
  if (r.family) return { kind: "family", schoolId: r.school_id };
  return null;
}

const area = (kind: "staff" | "family") => (kind === "staff" ? "admin" : "family");

// Each address and each computer can ask for at most 8 emails in 15 minutes.
async function allowEmail(email: string) {
  const keys = [`mail:${email}`, `mail-ip:${await clientIp()}`];
  for (const k of keys) if (await tooManyFailures(k)) return false;
  for (const k of keys) await recordFailure(k);
  return true;
}

// ---- Forgotten password ----

const RESET_SENT =
  "If there is an account with this email, we have sent it a link to choose a new password. The link works for 1 hour. Check the spam folder too.";

export async function requestPasswordReset(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  if (!isEmail(email)) return { error: "Check the email: it should look like name@example.com.", field: "email" };
  // The answer is the same whether or not the account exists.
  if (!(await allowEmail(email))) return { ok: RESET_SENT };
  const [user] = await db()<{ id: string }[]>`select id from auth_user where lower(email) = ${email}`;
  const acc = user ? await accountOf(user.id) : null;
  if (user && acc) {
    const token = await createLink(user.id, acc.schoolId, "reset_password");
    const link = `${await portalOrigin()}${await schoolPath(`/${area(acc.kind)}/reset-password`)}?token=${token}`;
    await sendSchoolMail(acc.schoolId, "resetPassword", email, link);
  }
  return { ok: RESET_SENT };
}

export async function resetPassword(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (password.length < 10) return { error: "Use at least 10 characters.", field: "password" };
  if (password.length > 128) return { error: "Use at most 128 characters.", field: "password" };
  if (password !== confirm) return { error: "The two passwords are different.", field: "confirm" };
  const ipKey = `ip:${await clientIp()}`;
  if (await tooManyFailures(ipKey)) return { error: "Too many attempts. Wait 15 minutes and try again." };

  const [school] = await db()<{ id: number }[]>`select id from schools where slug = ${await schoolSlug()}`;
  const link = school ? await claimLink(token, "reset_password", school.id) : null;
  if (!link) {
    await recordFailure(ipKey);
    return { error: "This link has already been used or has expired. Ask for a new one." };
  }
  const acc = await accountOf(link.user_id);
  if (!acc) return { error: "This account cannot use this portal." };

  const ctx = await auth().$context;
  const hashed = await ctx.password.hash(password);
  const accounts = await ctx.internalAdapter.findAccounts(link.user_id);
  if (accounts.some((a) => a.providerId === "credential")) await ctx.internalAdapter.updatePassword(link.user_id, hashed);
  else await ctx.internalAdapter.createAccount({ userId: link.user_id, providerId: "credential", accountId: link.user_id, password: hashed });
  await ctx.internalAdapter.deleteUserSessions(link.user_id); // signed out everywhere
  await db()`update email_links set used_at = now() where user_id = ${link.user_id} and purpose = 'reset_password' and used_at is null`;
  redirect(await schoolPath(`/${area(acc.kind)}?password=reset`));
}

// ---- Changing the account's email ----

async function signedInAccount() {
  const { user, staff } = await currentStaff();
  if (!user) return null;
  if (staff) return { userId: user.id, email: user.email, kind: "staff" as const, schoolId: staff.schoolId };
  const family = await currentFamily();
  if (family) return { userId: user.id, email: family.email, kind: "family" as const, schoolId: family.schoolId };
  return null;
}

export async function requestEmailChange(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const me = await signedInAccount();
  if (!me) return { error: "Your session has ended. Sign in again." };
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(fd.get("password") ?? "");
  if (!isEmail(email)) return { error: "Check the new email: it should look like name@example.com.", field: "email" };
  if (email === me.email.toLowerCase()) return { error: "This is already your email.", field: "email" };

  const pwKey = `pw:${me.userId}`;
  if (await tooManyFailures(pwKey)) return { error: "Too many attempts. Wait 15 minutes and try again." };
  const ctx = await auth().$context;
  const hash = (await ctx.internalAdapter.findAccounts(me.userId)).find((a) => a.providerId === "credential")?.password;
  if (!hash || !(await ctx.password.verify({ hash, password }))) {
    await recordFailure(pwKey);
    return { error: "Your current password is not right.", field: "password" };
  }

  const sent = { ok: `We sent a link to ${email}. Open it within 1 hour to confirm the change. Until then, your email stays ${me.email}.` };
  if (!(await allowEmail(email))) return sent;
  // If another account already uses that email, say the same and send nothing.
  const [taken] = await db()<{ id: string }[]>`select id from auth_user where lower(email) = ${email}`;
  if (taken) return sent;
  const token = await createLink(me.userId, me.schoolId, "change_email", email);
  const link = `${await portalOrigin()}${await schoolPath(`/${area(me.kind)}/confirm-email`)}?token=${token}`;
  await sendSchoolMail(me.schoolId, "confirmEmail", email, link);
  return sent;
}

export async function confirmEmailChange(_prev: AccountState, fd: FormData): Promise<AccountState> {
  const token = String(fd.get("token") ?? "");
  const ipKey = `ip:${await clientIp()}`;
  if (await tooManyFailures(ipKey)) return { error: "Too many attempts. Wait 15 minutes and try again." };
  const [school] = await db()<{ id: number }[]>`select id from schools where slug = ${await schoolSlug()}`;
  const link = school ? await claimLink(token, "change_email", school.id) : null;
  if (!link?.new_email) {
    await recordFailure(ipKey);
    return { error: "This link has already been used or has expired. Ask for a new one in Settings." };
  }
  const email = link.new_email;
  const [taken] = await db()<{ id: string }[]>`select id from auth_user where lower(email) = ${email} and id <> ${link.user_id}`;
  if (taken) return { error: "Another account already uses this email, so it cannot be changed." };
  try {
    await db()`update auth_user set email = ${email}, email_verified = true, updated_at = now() where id = ${link.user_id}`;
  } catch {
    return { error: "The email could not be changed. Try again in a moment." };
  }
  return { ok: `Your email is now ${email}. Use it the next time you sign in.` };
}
