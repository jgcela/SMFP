// One-time links sent by email (step 9): reset a password, confirm a new email.
// The email carries a random token; the database keeps only its SHA-256 hash.
// A link works for 1 hour and only once; asking for a new link cancels older ones.
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

export type LinkPurpose = "reset_password" | "change_email";
export const LINK_MINUTES = 60;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export const looksLikeToken = (t: string) => /^[A-Za-z0-9_-]{40,60}$/.test(t);

export async function createLink(userId: string, schoolId: number, purpose: LinkPurpose, newEmail: string | null = null) {
  const token = randomBytes(32).toString("base64url");
  await db().begin(async (tx) => {
    await tx`update email_links set used_at = now() where user_id = ${userId} and purpose = ${purpose} and used_at is null`;
    await tx`
      insert into email_links (token_hash, user_id, school_id, purpose, new_email, expires_at)
      values (${hash(token)}, ${userId}, ${schoolId}, ${purpose}, ${newEmail}, now() + make_interval(mins => ${LINK_MINUTES}))`;
  });
  return token;
}

type LinkRow = { user_id: string; school_id: number; new_email: string | null };

/** Whether a link can still be used (to show the right page), without using it. */
export async function peekLink(token: string, purpose: LinkPurpose, schoolId: number): Promise<LinkRow | null> {
  if (!looksLikeToken(token)) return null;
  const [r] = await db()<LinkRow[]>`
    select user_id, school_id, new_email from email_links
    where token_hash = ${hash(token)} and purpose = ${purpose} and school_id = ${schoolId} and used_at is null and expires_at > now()`;
  return r ?? null;
}

/** Uses a link: marks it used in the same statement that checks it, so it works only once. */
export async function claimLink(token: string, purpose: LinkPurpose, schoolId: number): Promise<LinkRow | null> {
  if (!looksLikeToken(token)) return null;
  const [r] = await db()<LinkRow[]>`
    update email_links set used_at = now()
    where token_hash = ${hash(token)} and purpose = ${purpose} and school_id = ${schoolId} and used_at is null and expires_at > now()
    returning user_id, school_id, new_email`;
  return r ?? null;
}
