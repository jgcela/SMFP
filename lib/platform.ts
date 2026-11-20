// FAMITENLY's own people (Super Admins) and what they do (step 10).
// Signing in is two steps: email and password (Better Auth, like school staff),
// then a 6-digit code from an authenticator app, or one of 10 backup codes.
// Only a session that passed both steps (platform_sessions) can use /platform.
// Every action is written to platform_audit.
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { db } from "./db";

// ---- Authenticator codes (TOTP, RFC 6238: SHA-1, 6 digits, 30 seconds) ----
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32(buf: Buffer) {
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function unbase32(s: string) {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function totpAt(secretB32: string, step: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", unbase32(secretB32)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, "0");
}

/** The time step a code belongs to (now, 30 s before or after), or null. */
export function matchTotp(secretB32: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const step = Math.floor(now / 30_000);
  for (const s of [step, step - 1, step + 1]) {
    const want = Buffer.from(totpAt(secretB32, s));
    if (timingSafeEqual(want, Buffer.from(code))) return s;
  }
  return null;
}

export const newTotpSecret = () => base32(randomBytes(20));

export function otpauthUrl(secretB32: string, email: string) {
  const label = encodeURIComponent(`FAMITENLY:${email}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=FAMITENLY&algorithm=SHA1&digits=6&period=30`;
}

// The authenticator secret is stored encrypted (AES-256-GCM, key from BETTER_AUTH_SECRET).
function key() {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is not set");
  return createHash("sha256").update(`famitenly-platform-totp:${s}`).digest();
}
export function sealSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${enc.toString("base64url")}.${c.getAuthTag().toString("base64url")}`;
}
export function openSecret(sealed: string) {
  const [v, iv, enc, tag] = sealed.split(".");
  if (v !== "v1") throw new Error("Unknown secret format");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
}

/** For the set-up page (never a server action): the secret to scan, made once. */
export async function ensureTotpSecret(userId: string) {
  const [row] = await db()<{ totp_secret: string | null; on: boolean }[]>`
    select totp_secret, totp_enabled_at is not null as on from platform_admins where user_id = ${userId}`;
  if (!row || row.on) return null;
  if (row.totp_secret) return openSecret(row.totp_secret);
  const secret = newTotpSecret();
  await db()`update platform_admins set totp_secret = ${sealSecret(secret)} where user_id = ${userId} and totp_secret is null`;
  const [again] = await db()<{ totp_secret: string }[]>`select totp_secret from platform_admins where user_id = ${userId}`;
  return openSecret(again.totp_secret);
}

// ---- Backup codes: 10 codes like "k7m2-9qxp", each works once. Only hashes are kept. ----
const CODE_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
export function newBackupCodes() {
  return Array.from({ length: 10 }, () => {
    const b = randomBytes(8);
    const c = Array.from(b, (x) => CODE_CHARS[x % CODE_CHARS.length]).join("");
    return `${c.slice(0, 4)}-${c.slice(4)}`;
  });
}
export const hashBackupCode = (code: string) =>
  createHash("sha256").update(`famitenly-backup:${code.toLowerCase().replace(/[^a-z0-9]/g, "")}`).digest("hex");

// ---- Who is signed in ----
export type PlatformAdmin = { userId: string; email: string; name: string; sessionId: string; totpOn: boolean; verified: boolean };

export const platformState = cache(async (): Promise<{ signedIn: boolean; admin: PlatformAdmin | null }> => {
  const s = await auth().api.getSession({ headers: await headers() });
  if (!s) return { signedIn: false, admin: null };
  const [row] = await db()<{ totp_on: boolean; verified: boolean }[]>`
    select pa.totp_enabled_at is not null as totp_on,
      exists (select 1 from platform_sessions ps where ps.session_id = ${s.session.id} and ps.user_id = pa.user_id) as verified
    from platform_admins pa where pa.user_id = ${s.user.id}`;
  if (!row) return { signedIn: true, admin: null };
  return {
    signedIn: true,
    admin: { userId: s.user.id, email: s.user.email, name: s.user.name, sessionId: s.session.id, totpOn: row.totp_on, verified: row.totp_on && row.verified },
  };
});

/** For /platform pages: a Super Admin who passed both steps, or off to the right step. */
export async function requirePlatformPage(): Promise<PlatformAdmin> {
  const { admin } = await platformState();
  if (!admin) redirect("/platform/sign-in");
  if (!admin.totpOn) redirect("/platform/two-step/setup");
  if (!admin.verified) redirect("/platform/two-step");
  return admin;
}

/** For /platform server actions. */
export async function requirePlatform(): Promise<PlatformAdmin> {
  const { admin } = await platformState();
  if (!admin || !admin.verified) throw new Error("Your FAMITENLY session has ended. Sign in again.");
  return admin;
}

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
}

/** Writes one line of the FAMITENLY log: who, what, in which school and when. */
export async function audit(who: { userId: string; email: string } | null, action: string, schoolId: number | null, detail = "") {
  await db()`insert into platform_audit (user_id, user_email, action, school_id, detail, ip)
    values (${who?.userId ?? null}, ${who?.email ?? ""}, ${action}, ${schoolId}, ${detail.slice(0, 2000)}, ${await clientIp()})`;
}

// ---- Support mode ----
export type SupportVisit = { userId: string; email: string; name: string; schoolId: number; schoolName: string; expiresAt: Date };

/**
 * A FAMITENLY person helping inside this request's school: only with a session
 * that passed both steps, while the school allows it (schools.support_until) and
 * until the visit ends.
 */
export const supportVisit = cache(async (): Promise<SupportVisit | null> => {
  const slug = (await headers()).get("x-portal-school");
  if (!slug) return null;
  const s = await auth().api.getSession({ headers: await headers() });
  if (!s) return null;
  const [v] = await db()<{ school_id: number; name: string; expires_at: Date }[]>`
    select sc.id as school_id, sc.name, least(ps.expires_at, sc.support_until) as expires_at
    from platform_support ps
    join schools sc on sc.id = ps.school_id
    join platform_sessions pss on pss.session_id = ps.session_id and pss.user_id = ps.user_id
    join platform_admins pa on pa.user_id = ps.user_id and pa.totp_enabled_at is not null
    where ps.session_id = ${s.session.id} and ps.user_id = ${s.user.id} and sc.slug = ${slug}
      and ps.expires_at > now() and sc.support_until > now() and sc.status <> 'suspended'`;
  if (!v) return null;
  return { userId: s.user.id, email: s.user.email, name: s.user.name, schoolId: v.school_id, schoolName: v.name, expiresAt: v.expires_at };
});
