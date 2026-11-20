"use server";
// Server actions of FAMITENLY's panel (step 10). Every action checks, on the
// server, a Super Admin session that passed both sign-in steps, and writes what
// it did to platform_audit.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { db } from "../../lib/db";
import { sendSchoolMail, portalOrigin } from "../../lib/emails";
import { newFamilyCode } from "../../lib/family";
import { contrast, mix } from "../../lib/panel-theme";
import {
  audit, clientIp, hashBackupCode, matchTotp, newBackupCodes, openSecret, platformState, requirePlatform,
} from "../../lib/platform";
import { DEFAULT_MODULES, PLAN_IDS, allowedModules, planOf, type SchoolStatus } from "../../lib/plans";
import { SLUG_RE } from "../../lib/portal";
import { getStorage } from "../../lib/storage";
import { clearFailures, recordFailure, tooManyFailures } from "../../lib/staff";

export type PfState = { error?: string; ok?: string; codes?: string[]; link?: string; field?: string } | undefined;

const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) ?? "").trim().slice(0, max);

// The proxy keeps which schools exist and which are suspended for 20 seconds;
// forget it after a change so this server sees the change at once.
function forgetSchoolState() {
  (globalThis as { __schoolState?: unknown }).__schoolState = undefined;
}

async function startVerifiedSession(userId: string) {
  const s = await auth().api.getSession({ headers: await headers() });
  if (!s || s.user.id !== userId) throw new Error("Your session has ended. Sign in again.");
  await db()`insert into platform_sessions (session_id, user_id) values (${s.session.id}, ${userId}) on conflict (session_id) do nothing`;
}

// ---- Sign in, step 1: email and password ----
export async function platformSignIn(_prev: PfState, fd: FormData): Promise<PfState> {
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "").slice(0, 200);
  if (!email || !password) return { error: "Enter your email and password." };
  const keys = [`pf-email:${email}`, `pf-ip:${await clientIp()}`];
  for (const k of keys) if (await tooManyFailures(k)) return { error: "Too many attempts. Wait 15 minutes and try again." };
  let userId = "";
  try {
    const r = await auth().api.signInEmail({ body: { email, password }, headers: await headers() });
    userId = r.user.id;
  } catch {
    for (const k of keys) await recordFailure(k);
    return { error: "Email or password is incorrect." };
  }
  const [admin] = await db()<{ on: boolean }[]>`select totp_enabled_at is not null as on from platform_admins where user_id = ${userId}`;
  if (!admin) {
    try {
      await auth().api.signOut({ headers: await headers() });
    } catch {}
    for (const k of keys) await recordFailure(k);
    return { error: "This account cannot use the FAMITENLY panel." };
  }
  await clearFailures(keys[0]);
  redirect(admin.on ? "/platform/two-step" : "/platform/two-step/setup");
}

export async function platformSignOut() {
  const s = await auth().api.getSession({ headers: await headers() }).catch(() => null);
  if (s) {
    await db()`delete from platform_sessions where session_id = ${s.session.id}`;
    await db()`delete from platform_support where session_id = ${s.session.id}`;
  }
  try {
    await auth().api.signOut({ headers: await headers() });
  } catch {}
  redirect("/platform/sign-in");
}

// ---- Sign in, step 2: authenticator code or backup code ----
export async function platformVerify(_prev: PfState, fd: FormData): Promise<PfState> {
  const { admin } = await platformState();
  if (!admin) redirect("/platform/sign-in");
  if (!admin.totpOn) redirect("/platform/two-step/setup");
  const key = `pf-2fa:${admin.userId}`;
  if (await tooManyFailures(key)) return { error: "Too many attempts. Wait 15 minutes and try again." };
  const raw = str(fd, "code", 40);
  const code = raw.replace(/\s/g, "");
  const [row] = await db()<{ totp_secret: string; totp_last_step: string; backup_codes: string[] }[]>`
    select totp_secret, totp_last_step::text, backup_codes from platform_admins where user_id = ${admin.userId}`;
  let ok = false;
  let how = "authenticator code";
  if (/^\d{6}$/.test(code)) {
    const step = matchTotp(openSecret(row.totp_secret), code);
    if (step !== null && step > Number(row.totp_last_step)) {
      const r = await db()`update platform_admins set totp_last_step = ${step} where user_id = ${admin.userId} and totp_last_step < ${step}`;
      ok = r.count === 1;
    }
  } else if (code) {
    const h = hashBackupCode(code);
    const r = await db()`update platform_admins set backup_codes = array_remove(backup_codes, ${h})
      where user_id = ${admin.userId} and ${h} = any(backup_codes)`;
    ok = r.count === 1;
    how = "backup code";
  }
  if (!ok) {
    await recordFailure(key);
    await audit({ userId: admin.userId, email: admin.email }, "sign_in.failed", null, "Wrong second-step code");
    return { error: "That code is not right, or it was already used. Try the newest code in your app." };
  }
  await clearFailures(key);
  await startVerifiedSession(admin.userId);
  await audit({ userId: admin.userId, email: admin.email }, "sign_in", null, `Signed in with an ${how}`);
  redirect("/platform");
}

// ---- Two-step set-up (mandatory, once) ----
export async function confirmTwoStep(_prev: PfState, fd: FormData): Promise<PfState> {
  const { admin } = await platformState();
  if (!admin) redirect("/platform/sign-in");
  if (admin.totpOn) return { error: "Two-step sign-in is already on." };
  const key = `pf-2fa:${admin.userId}`;
  if (await tooManyFailures(key)) return { error: "Too many attempts. Wait 15 minutes and try again." };
  const [row] = await db()<{ totp_secret: string | null }[]>`select totp_secret from platform_admins where user_id = ${admin.userId}`;
  if (!row?.totp_secret) return { error: "Reload this page to get a new code to scan." };
  const step = matchTotp(openSecret(row.totp_secret), str(fd, "code", 20).replace(/\s/g, ""));
  if (step === null) {
    await recordFailure(key);
    return { error: "That code is not right. Check that your phone's time is correct and type the newest code." };
  }
  const codes = newBackupCodes();
  await db()`update platform_admins set totp_enabled_at = now(), totp_last_step = ${step}, backup_codes = ${codes.map(hashBackupCode)}
    where user_id = ${admin.userId} and totp_enabled_at is null`;
  await clearFailures(key);
  await startVerifiedSession(admin.userId);
  await audit({ userId: admin.userId, email: admin.email }, "two_step.enabled", null, "Turned on two-step sign-in and got 10 backup codes");
  return { ok: "Two-step sign-in is on.", codes };
}

export async function newBackupCodesAction(_prev: PfState, fd: FormData): Promise<PfState> {
  const admin = await requirePlatform();
  const [row] = await db()<{ totp_secret: string; totp_last_step: string }[]>`
    select totp_secret, totp_last_step::text from platform_admins where user_id = ${admin.userId}`;
  const step = matchTotp(openSecret(row.totp_secret), str(fd, "code", 20).replace(/\s/g, ""));
  if (step === null || step <= Number(row.totp_last_step)) return { error: "Type the newest code from your authenticator app." };
  const codes = newBackupCodes();
  await db()`update platform_admins set backup_codes = ${codes.map(hashBackupCode)}, totp_last_step = ${step} where user_id = ${admin.userId}`;
  await audit(admin, "two_step.new_backup_codes", null, "Made 10 new backup codes (the old ones stop working)");
  return { ok: "New backup codes made. The old ones no longer work.", codes };
}

// ---- The first Super Admin (only while there is none, with PLATFORM_SETUP_CODE) ----
export async function createFirstAdmin(_prev: PfState, fd: FormData): Promise<PfState> {
  const expected = process.env.PLATFORM_SETUP_CODE ?? "";
  if (expected.length < 12) return { error: "The set-up code is not configured on the server." };
  const ipKey = `pf-setup:${await clientIp()}`;
  if (await tooManyFailures(ipKey)) return { error: "Too many attempts. Wait 15 minutes and try again." };
  const given = String(fd.get("setup_code") ?? "");
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) {
    await recordFailure(ipKey);
    return { error: "The set-up code is not right.", field: "setup_code" };
  }
  const name = str(fd, "name", 100);
  const email = str(fd, "email").toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!name) return { error: "Enter your name.", field: "name" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email.", field: "email" };
  if (password.length < 12 || password.length > 128) return { error: "Use a password of 12 to 128 characters.", field: "password" };
  if (password !== String(fd.get("confirm") ?? "")) return { error: "The two passwords are different.", field: "confirm" };

  const [{ n }] = await db()<{ n: number }[]>`select count(*)::int as n from platform_admins`;
  if (n > 0) return { error: "FAMITENLY already has a Super Admin. Sign in instead." };

  const ctx = await auth().$context;
  const existing = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
  let userId: string;
  if (existing) {
    // An account that already exists (e.g. school staff): prove it is yours with its password.
    const cred = existing.accounts.find((x) => x.providerId === "credential");
    if (!cred?.password || !(await ctx.password.verify({ hash: cred.password, password }))) {
      await recordFailure(ipKey);
      return { error: "This email already has an account. Type that account's current password.", field: "password" };
    }
    userId = existing.user.id;
  } else {
    const u = await ctx.internalAdapter.createUser({ email, name, emailVerified: true }, { method: "admin" });
    await ctx.internalAdapter.createAccount({ userId: u.id, providerId: "credential", accountId: u.id, password: await ctx.password.hash(password) });
    userId = u.id;
  }
  const r = await db()`insert into platform_admins (user_id) select ${userId} where not exists (select 1 from platform_admins)`;
  if (r.count !== 1) return { error: "FAMITENLY already has a Super Admin. Sign in instead." };
  await audit({ userId, email }, "super_admin.created", null, existing ? "First Super Admin (existing account)" : "First Super Admin");
  await auth().api.signInEmail({ body: { email, password }, headers: await headers() });
  redirect("/platform/two-step/setup");
}

// ---- Schools ----
const RESERVED = new Set(["platform", "admin", "api", "s", "assets", "welcome", "suspended", "family", "files", "logo", "www", "app", "famitenly"]);
const HEX = /^#[0-9a-f]{6}$/i;
const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function schoolYear(now = new Date()) {
  const y = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${y}–${String((y + 1) % 100).padStart(2, "0")}`;
}

/** Panel colours from the two colours chosen for the school. */
function themeFrom(name: string, primary: string, accent: string, hasLogo: boolean) {
  const ink = contrast(primary, "#FFFFFF") >= 4.5 ? primary : mix(primary, "#000000", 0.6);
  return {
    shortName: name.length > 24 ? name.slice(0, 24).trim() : name,
    markUrl: hasLogo ? "logo" : "",
    colors: {
      page: mix(primary, "#FFFFFF", 0.06), surface: "#FFFFFF", ink, text: "#1F2937", muted: "#4B5563",
      line: mix(primary, "#FFFFFF", 0.12), soft: mix(primary, "#FFFFFF", 0.14), accent, link: ink,
    },
    categories: {},
    portal: { primary, accent },
  };
}

async function inviteAdmin(schoolId: number, slug: string, email: string): Promise<{ sent: boolean; link: string; existing: boolean }> {
  const ctx = await auth().$context;
  let user = (await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true })) ?? null;
  if (!user) {
    const u = await ctx.internalAdapter.createUser({ email, name: email.split("@")[0], emailVerified: true }, { method: "admin" });
    user = { user: u, accounts: [] };
  }
  await db()`insert into school_staff (user_id, school_id, role) values (${user.user.id}, ${schoolId}, 'admin') on conflict do nothing`;
  const hasPassword = user.accounts.some((a) => a.providerId === "credential" && a.password);
  const origin = `${await portalOrigin()}/s/${slug}`;
  let link = `${origin}/admin`;
  if (!hasPassword) {
    const token = randomBytes(32).toString("base64url");
    await db()`insert into staff_setup_links (token_hash, user_id, expires_at)
      values (${createHash("sha256").update(token).digest("hex")}, ${user.user.id}, now() + interval '7 days')`;
    link = `${origin}/admin/set-password?token=${token}`;
  }
  const sent = await sendSchoolMail(schoolId, "staffInvite", email, link);
  return { sent, link, existing: hasPassword };
}

export async function createSchool(_prev: PfState, fd: FormData): Promise<PfState> {
  const admin = await requirePlatform();
  const name = str(fd, "name", 120);
  const slug = str(fd, "slug", 32).toLowerCase();
  const timezone = str(fd, "timezone", 64);
  const primary = str(fd, "primary", 7);
  const accent = str(fd, "accent", 7);
  const plan = str(fd, "plan", 20);
  const status = str(fd, "status", 20) as SchoolStatus;
  const email = str(fd, "admin_email").toLowerCase();
  if (!name) return { error: "Enter the school's name.", field: "name" };
  if (!SLUG_RE.test(slug) || RESERVED.has(slug))
    return { error: "Use 2 to 32 lowercase letters, numbers or dashes for the code, like “demo-school”.", field: "slug" };
  let tzOk = false;
  try {
    tzOk = !!timezone && Intl.DateTimeFormat("en-US", { timeZone: timezone }).resolvedOptions().timeZone.length > 0;
  } catch {}
  if (!tzOk) return { error: "Pick the school's time zone.", field: "timezone" };
  if (!HEX.test(primary) || !HEX.test(accent)) return { error: "Pick the two colours.", field: "primary" };
  if (!PLAN_IDS.includes(plan as never)) return { error: "Pick a plan.", field: "plan" };
  if (status !== "active" && status !== "trial") return { error: "Pick the state.", field: "status" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter the first administrator's email.", field: "admin_email" };
  const logo = fd.get("logo");
  let logoBytes: Uint8Array | null = null;
  let logoExt = "";
  if (logo instanceof File && logo.size > 0) {
    logoExt = LOGO_TYPES[logo.type] ?? "";
    if (!logoExt) return { error: "The logo must be a PNG, JPG or WebP image.", field: "logo" };
    if (logo.size > 1024 * 1024) return { error: "The logo must be 1 MB or smaller.", field: "logo" };
    logoBytes = new Uint8Array(await logo.arrayBuffer());
  }
  const [taken] = await db()<{ id: number }[]>`select id from schools where slug = ${slug}`;
  if (taken) return { error: `The code “${slug}” is already used by another school.`, field: "slug" };

  const theme = themeFrom(name, primary, accent, !!logoBytes);
  const modules = allowedModules(plan, DEFAULT_MODULES);
  const [s] = await db()<{ id: number }[]>`
    insert into schools (slug, name, school_year, timezone, plan, status, modules, panel_theme, family_code, logo_url)
    values (${slug}, ${name}, ${schoolYear()}, ${timezone}, ${plan}, ${status}, ${modules}, ${db().json(theme)}, ${newFamilyCode()}, ${logoBytes ? "logo" : ""})
    returning id`;
  // Step 11a: the school's first year, active, with its look and modules.
  const label = schoolYear();
  const first = Number(/^\d{4}/.exec(label)?.[0] ?? new Date().getFullYear());
  const [year] = await db()<{ id: number }[]>`
    insert into school_years (school_id, label, starts_on, ends_on, status, activated_at, logo_url, panel_theme, modules, created_by)
    values (${s.id}, ${label}, ${`${first}-07-01`}, ${`${first + 1}-06-30`}, 'active', now(), ${logoBytes ? "logo" : ""}, ${db().json(theme)}, ${modules}, ${admin.email})
    returning id`;
  if (logoBytes) {
    const key = `logos/${s.id}/logo-${randomBytes(4).toString("hex")}.${logoExt}`;
    try {
      await getStorage().put(key, logoBytes, logo instanceof File ? logo.type : "image/png");
      await db()`update schools set logo_key = ${key} where id = ${s.id}`;
      await db()`update school_years set logo_key = ${key} where id = ${year.id}`;
    } catch (e) {
      console.error(`[platform] logo upload: ${e instanceof Error ? e.message : e}`);
      await db()`update schools set logo_url = '', panel_theme = panel_theme || '{"markUrl": ""}'::jsonb where id = ${s.id}`;
      await db()`update school_years set logo_url = '', panel_theme = panel_theme || '{"markUrl": ""}'::jsonb where id = ${year.id}`;
    }
  }
  forgetSchoolState();
  const inv = await inviteAdmin(s.id, slug, email);
  await audit(admin, "school.created", s.id,
    `Created “${name}” (/s/${slug}), plan ${planOf(plan).name}, ${status}; invited ${email}${inv.sent ? "" : " (email not sent)"}`);
  redirect(`/platform/schools/${s.id}?created=${inv.sent ? "sent" : "unsent"}`);
}

async function schoolById(id: number) {
  const [s] = await db()<{ id: number; slug: string; name: string; plan: string; status: SchoolStatus; modules: string[] }[]>`
    select s.id, s.slug, s.name, s.plan, s.status, y.modules
    from schools s join school_years y on y.school_id = s.id and y.status = 'active' where s.id = ${id}`;
  return s ?? null;
}

export async function setPlanAndModules(_prev: PfState, fd: FormData): Promise<PfState> {
  const admin = await requirePlatform();
  const s = await schoolById(Number(fd.get("school_id")));
  if (!s) return { error: "That school does not exist." };
  const plan = str(fd, "plan", 20);
  if (!PLAN_IDS.includes(plan as never)) return { error: "Pick a plan." };
  const wanted = fd.getAll("modules").map(String);
  const modules = allowedModules(plan, wanted);
  await db()`update schools set plan = ${plan}, modules = ${modules} where id = ${s.id}`;
  // Step 11a: modules belong to each year; the change applies to the active
  // year and to the one being prepared. Archived years stay as they were.
  await db()`update school_years set modules = ${modules} where school_id = ${s.id} and status <> 'archived'`;
  const parts: string[] = [];
  if (plan !== s.plan) parts.push(`plan ${planOf(s.plan).name} → ${planOf(plan).name}`);
  const on = modules.filter((m) => !s.modules.includes(m));
  const off = s.modules.filter((m) => !modules.includes(m as never));
  if (on.length) parts.push(`turned on ${on.join(", ")}`);
  if (off.length) parts.push(`turned off ${off.join(", ")}`);
  if (parts.length) await audit(admin, "school.plan_modules", s.id, parts.join("; "));
  revalidatePath(`/platform/schools/${s.id}`);
  return { ok: parts.length ? "Saved." : "Nothing changed." };
}

export async function setSchoolStatus(_prev: PfState, fd: FormData): Promise<PfState> {
  const admin = await requirePlatform();
  const s = await schoolById(Number(fd.get("school_id")));
  if (!s) return { error: "That school does not exist." };
  const status = str(fd, "status", 20) as SchoolStatus;
  if (!["active", "trial", "suspended"].includes(status)) return { error: "Pick a state." };
  if (status === s.status) return { ok: "Nothing changed." };
  await db()`update schools set status = ${status} where id = ${s.id}`;
  if (status === "suspended") {
    // Support visits end with the suspension.
    await db()`delete from platform_support where school_id = ${s.id}`;
  }
  forgetSchoolState();
  revalidatePath(`/platform/schools/${s.id}`);
  const verb = status === "suspended" ? "Suspended" : s.status === "suspended" ? `Reactivated (${status})` : `State ${s.status} → ${status}`;
  await audit(admin, status === "suspended" ? "school.suspended" : s.status === "suspended" ? "school.reactivated" : "school.status", s.id, verb);
  return { ok: status === "suspended" ? "The school is suspended. Its portal shows a notice and nobody of the school can sign in." : "Saved." };
}

export async function resendInvite(_prev: PfState, fd: FormData): Promise<PfState> {
  const admin = await requirePlatform();
  const s = await schoolById(Number(fd.get("school_id")));
  if (!s) return { error: "That school does not exist." };
  const email = str(fd, "email").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a valid email." };
  const inv = await inviteAdmin(s.id, s.slug, email);
  await audit(admin, "school.invite", s.id, `Invited ${email} as administrator${inv.sent ? "" : " (email not sent)"}`);
  revalidatePath(`/platform/schools/${s.id}`);
  return inv.sent
    ? { ok: `Invitation sent to ${email}.` }
    : { error: "The email could not be sent. You can send this link yourself:", link: inv.link };
}

// ---- Support mode ----
export async function startSupport(fd: FormData) {
  const admin = await requirePlatform();
  const id = Number(fd.get("school_id"));
  const [s] = await db()<{ slug: string; until: Date | null; status: string }[]>`
    select slug, support_until as until, status from schools where id = ${id}`;
  if (!s || !s.until || s.until <= new Date() || s.status === "suspended") redirect(`/platform/schools/${id}?support=denied`);
  const end = new Date(Math.min(s.until.getTime(), Date.now() + 60 * 60 * 1000));
  await db()`insert into platform_support (session_id, user_id, school_id, expires_at) values (${admin.sessionId}, ${admin.userId}, ${id}, ${end})
    on conflict (session_id) do update set school_id = excluded.school_id, expires_at = excluded.expires_at, started_at = now()`;
  await audit(admin, "support.started", id, `Entered the staff panel in support mode until ${end.toISOString()}`);
  redirect(`/s/${s.slug}/admin`);
}

export async function endSupport(fd: FormData) {
  const admin = await requirePlatform();
  const id = Number(fd.get("school_id"));
  const r = await db()`delete from platform_support where session_id = ${admin.sessionId} and school_id = ${id}`;
  if (r.count) await audit(admin, "support.ended", id, "Left support mode");
  redirect(`/platform/schools/${id}`);
}
