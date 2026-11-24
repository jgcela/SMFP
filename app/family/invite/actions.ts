"use server";
// Using a FACTS invitation (lib/facts-accounts.ts). The school comes from the
// address only. A new account chooses its password here; an existing account
// confirms with its current password. Either way the link works once.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "../../../lib/auth";
import { db } from "../../../lib/db";
import type { Db } from "../../../lib/facts-access";
import { acceptAsExistingAccount, acceptAsNewAccount } from "../../../lib/facts-accounts";
import { schoolPath, schoolSlug } from "../../../lib/portal";
import { clearFailures, recordFailure, tooManyFailures } from "../../../lib/staff";

export type InviteState = { error?: string; field?: string; message?: string } | undefined;

async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}
async function schoolId() {
  const [s] = await db()<{ id: number }[]>`select id from schools where slug = ${await schoolSlug()} and status <> 'suspended'`;
  return s?.id ?? 0;
}
const sql = () => db() as unknown as Db;

export async function acceptNew(_prev: InviteState, fd: FormData): Promise<InviteState> {
  const token = String(fd.get("token") ?? "");
  const name = String(fd.get("name") ?? "").trim().replace(/\s+/g, " ");
  const password = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirm") ?? "");
  if (name.length < 2) return { error: "Write your family name (for example: The García family).", field: "name" };
  if (name.length > 100) return { error: "The name can be at most 100 characters.", field: "name" };
  if (password.length < 10) return { error: "Use at least 10 characters for the password.", field: "password" };
  if (password.length > 128) return { error: "Use at most 128 characters for the password.", field: "password" };
  if (password !== confirm) return { error: "The two passwords are different.", field: "confirm" };
  const ipKey = `ip:${await clientIp()}`;
  if (await tooManyFailures(ipKey)) return { error: "Too many attempts. Wait 15 minutes and try again." };

  const ctx = await auth().$context;
  const r = await acceptAsNewAccount(sql(), await schoolId(), token, name,
    async (email) => {
      const user = await ctx.internalAdapter.createUser({ name, email, emailVerified: true }, { method: "email-password" });
      await ctx.internalAdapter.createAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: await ctx.password.hash(password) });
      return user.id;
    },
    async (userId) => { await db()`delete from auth_user where id = ${userId}`; },
  );
  if (!r.ok) {
    if (r.code === "invalid") await recordFailure(ipKey);
    return { error: r.error };
  }
  redirect(`${await schoolPath("/family")}?invite=done`);
}

export async function acceptExisting(_prev: InviteState, fd: FormData): Promise<InviteState> {
  const token = String(fd.get("token") ?? "");
  const password = String(fd.get("password") ?? "").slice(0, 200);
  if (!password) return { error: "Enter the password of your account.", field: "password" };
  const ipKey = `ip:${await clientIp()}`;
  if (await tooManyFailures(ipKey)) return { error: "Too many attempts. Wait 15 minutes and try again." };

  const ctx = await auth().$context;
  let pwKey = "";
  const r = await acceptAsExistingAccount(sql(), await schoolId(), token, async (userId) => {
    pwKey = `pw:${userId}`;
    if (await tooManyFailures(pwKey)) return false;
    const hash = (await ctx.internalAdapter.findAccounts(userId)).find((a) => a.providerId === "credential")?.password;
    return !!hash && (await ctx.password.verify({ hash, password }));
  });
  if (!r.ok) {
    if (r.code === "failed" && pwKey) { await recordFailure(pwKey); await recordFailure(ipKey); return { error: r.error, field: "password" }; }
    if (r.code === "invalid") await recordFailure(ipKey);
    return { error: r.error };
  }
  if (pwKey) await clearFailures(pwKey);
  if (r.familyStatus && r.familyStatus !== "approved") {
    return { message: "Your account is now linked to your children's records. The school has turned off or not approved this account, so contact the school office to be able to sign in." };
  }
  redirect(`${await schoolPath("/family")}?invite=done`);
}
