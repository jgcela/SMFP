"use server";
// Server actions for the staff area. Every write checks the session and the
// school_staff link on the server; the browser never chooses the school.
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "../../lib/auth";
import { db } from "../../lib/db";
import { clearFailures, currentStaff, recordFailure, tooManyFailures } from "../../lib/staff";
import { schoolPath } from "../../lib/portal";

export type FormState = { error?: string; ok?: string } | undefined;

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

// ---- Sign in / out ----
export async function signIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "Enter your email and password." };
  const keys = [`email:${email}`, `ip:${await clientIp()}`];
  for (const k of keys) {
    if (await tooManyFailures(k)) return { error: "Too many attempts. Wait 15 minutes and try again." };
  }
  try {
    await auth().api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch {
    for (const k of keys) await recordFailure(k);
    return { error: "Email or password is incorrect." };
  }
  await clearFailures(keys[0]);
  redirect(await schoolPath("/admin"));
}

export async function signOut() {
  try {
    await auth().api.signOut({ headers: await headers() });
  } catch {
    // already signed out
  }
  redirect(await schoolPath("/admin"));
}

// ---- The notice ----
const SAFE_HREF = /^(https?:\/\/[^\s]+|#[\w-]*|\/[^\s]*|mailto:[^\s]+|tel:[^\s]+)$/i;

export async function saveNotice(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user, staff } = await currentStaff();
  if (!user) return { error: "Your session has ended. Sign in again." };
  if (!staff) return { error: "This account cannot edit this school’s portal." };

  const message = String(fd.get("message") ?? "").trim();
  const linkLabel = String(fd.get("link_label") ?? "").trim();
  const linkHref = String(fd.get("link_href") ?? "").trim();
  const show = fd.get("show") === "on";

  if (show && !message) return { error: "Write the notice text, or turn off “Show on the portal”." };
  if (message.length > 300) return { error: "The notice text can be at most 300 characters." };
  if (linkLabel.length > 60) return { error: "The link text can be at most 60 characters." };
  if (linkHref.length > 500) return { error: "The link address is too long." };
  if (linkHref && !SAFE_HREF.test(linkHref)) return { error: "The link address must start with https://" };
  if (linkHref && !linkLabel) return { error: "Add the link text (for example: Read more)." };
  if (linkLabel && !linkHref) return { error: "Add the link address, or leave both link fields empty." };

  await db().begin(async (sql) => {
    const [current] = await sql<{ id: number }[]>`
      select id from notices where school_id = ${staff.schoolId} order by created_at desc, id desc limit 1 for update`;
    let id = current?.id;
    if (id) {
      await sql`
        update notices set message = ${message}, link_label = ${linkLabel}, link_href = ${linkHref},
          is_active = ${show}, show_from = null, show_until = null
        where id = ${id} and school_id = ${staff.schoolId}`;
    } else {
      [{ id }] = await sql<{ id: number }[]>`
        insert into notices (school_id, message, link_label, link_href, is_active)
        values (${staff.schoolId}, ${message}, ${linkLabel}, ${linkHref}, ${show}) returning id`;
    }
    // Only one notice per school: the one edited here.
    await sql`update notices set is_active = false where school_id = ${staff.schoolId} and id <> ${id!}`;
  });
  revalidatePath("/");
  return { ok: show ? "Saved. The portal now shows this notice." : "Saved. The notice is hidden from the portal." };
}

// ---- Choosing a password with a one-time link ----
export async function setPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (!/^[A-Za-z0-9_-]{30,100}$/.test(token)) return { error: "This link is not valid. Ask for a new one." };
  if (password.length < 10) return { error: "Use at least 10 characters." };
  if (password.length > 128) return { error: "Use at most 128 characters." };
  if (password !== confirm) return { error: "The two passwords are different." };
  if (await tooManyFailures(`ip:${await clientIp()}`)) return { error: "Too many attempts. Wait 15 minutes and try again." };

  const hash = createHash("sha256").update(token).digest("hex");
  // Claim the link (once, before it expires).
  const [link] = await db()<{ user_id: string }[]>`
    update staff_setup_links set used_at = now()
    where token_hash = ${hash} and used_at is null and expires_at > now()
    returning user_id`;
  if (!link) {
    await recordFailure(`ip:${await clientIp()}`);
    return { error: "This link has already been used or has expired. Ask for a new one." };
  }

  const ctx = await auth().$context;
  const hashed = await ctx.password.hash(password);
  const accounts = await ctx.internalAdapter.findAccounts(link.user_id);
  const credential = accounts.find((a) => a.providerId === "credential");
  if (credential) await ctx.internalAdapter.updatePassword(link.user_id, hashed);
  else await ctx.internalAdapter.createAccount({ userId: link.user_id, providerId: "credential", accountId: link.user_id, password: hashed });
  await ctx.internalAdapter.deleteUserSessions(link.user_id); // sign out everywhere
  redirect(await schoolPath("/admin?password=set"));
}
