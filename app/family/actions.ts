"use server";
// Families: register with the school's code, then sign in once the school approves.
// A family that is not approved never gets a session.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { mailSchool, sendSchoolMail } from "../../lib/emails";
import { db } from "../../lib/db";
import { familyOfUser, normalizeCode, STATUS_MESSAGE } from "../../lib/family";
import { schoolSlug } from "../../lib/portal";
import { clearFailures, recordFailure, tooManyFailures } from "../../lib/staff";

export type FamilyFormState = { error?: string; field?: string; done?: "pending" | "status"; message?: string } | undefined;

const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

export async function registerFamily(_prev: FamilyFormState, fd: FormData): Promise<FamilyFormState> {
  const name = String(fd.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  const code = normalizeCode(String(fd.get("code") ?? ""));

  if (name.length < 2) return { error: "Write your family name (for example: The García family).", field: "name" };
  if (name.length > 100) return { error: "The name can be at most 100 characters.", field: "name" };
  if (!EMAIL.test(email) || email.length > 200) return { error: "Check the email: it should look like name@example.com.", field: "email" };
  if (password.length < 10) return { error: "Use at least 10 characters for the password.", field: "password" };
  if (password.length > 128) return { error: "Use at most 128 characters for the password.", field: "password" };
  if (password !== confirm) return { error: "The two passwords are different.", field: "confirm" };
  if (!code) return { error: "Write the school code. The school office gives it to families.", field: "code" };

  const ipKey = `ip:${await clientIp()}`;
  if (await tooManyFailures(ipKey)) return { error: "Too many attempts. Wait 15 minutes and try again." };

  const [school] = await db()<{ id: number; family_code: string | null }[]>`
    select id, family_code from schools where slug = ${schoolSlug()}`;
  if (!school?.family_code || normalizeCode(school.family_code) !== code) {
    await recordFailure(ipKey);
    return { error: "That school code is not right. Check it with the school office.", field: "code" };
  }

  const ctx = await auth().$context;
  if (await ctx.internalAdapter.findUserByEmail(email)) {
    return { error: "There is already an account with this email. Sign in instead.", field: "email" };
  }
  let userId: string | null = null;
  try {
    const user = await ctx.internalAdapter.createUser({ name, email, emailVerified: false }, { method: "email-password" });
    userId = user.id;
    await ctx.internalAdapter.createAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: await ctx.password.hash(password) });
    await db()`insert into families (school_id, user_id, name) values (${school.id}, ${user.id}, ${name})`;
  } catch {
    if (userId) await db()`delete from auth_user where id = ${userId}`.catch(() => {});
    return { error: "The account could not be created. Try again in a moment." };
  }
  // Step 9: tell the family we received it, and the school that someone is waiting.
  await sendSchoolMail(school.id, "familyReceived", email, name);
  const notify = (await mailSchool(school.id))?.notifyEmail;
  if (notify) await sendSchoolMail(school.id, "schoolNewFamily", notify, name, email);
  return { done: "pending", message: STATUS_MESSAGE.pending };
}

export async function familySignIn(_prev: FamilyFormState, fd: FormData): Promise<FamilyFormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "Enter your email and password." };
  const keys = [`email:${email}`, `ip:${await clientIp()}`];
  for (const k of keys) if (await tooManyFailures(k)) return { error: "Too many attempts. Wait 15 minutes and try again." };

  // Check the password and the family's status BEFORE creating a session.
  const ctx = await auth().$context;
  const found = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  const hash = found?.accounts.find((a) => a.providerId === "credential")?.password;
  const ok = hash ? await ctx.password.verify({ hash, password }) : false;
  if (!found || !ok) {
    for (const k of keys) await recordFailure(k);
    return { error: "Email or password is incorrect." };
  }
  await clearFailures(keys[0]);
  const family = await familyOfUser(found.user.id);
  if (!family) return { error: "This account is not a family account of this school. Staff sign in at /admin." };
  if (family.status !== "approved") return { done: "status", message: STATUS_MESSAGE[family.status] };

  try {
    await auth().api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch {
    return { error: "You could not be signed in. Try again in a moment." };
  }
  // Back to the page that asked them to sign in (e.g. the Volunteer page), if it is on this site.
  const next = String(fd.get("next") ?? "");
  redirect(/^\/(?!\/)[\w\-./#?=&%]*$/.test(next) && !next.includes("\\") ? next : "/family");
}

export async function familySignOut() {
  try {
    await auth().api.signOut({ headers: await headers() });
  } catch {
    // already signed out
  }
  redirect("/family");
}
