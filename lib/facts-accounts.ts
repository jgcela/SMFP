// Verified association between a portal account and a FACTS "Parent Individual ID"
// of one school, made only through an invitation link.
//
//  - The school gives an email for a Parent ID (typed in the panel, or a CSV with
//    "Parent Individual ID" and an email column). Both use prepareInvitations().
//  - The adult gets a link (7 days, works once; a new link cancels the older one).
//      * No account with that email: they choose a family name and a password.
//      * An account already uses that email: they confirm with that account's
//        password. Never automatic.
//  - Only then are facts_parents.user_id and verified_at set, and every FACTS "Yes" of that
//    parent starts to count at once (lib/student-access.ts reads it live).
// Nothing is ever matched by name, Family ID or position in a file.
import { createHash, randomBytes } from "node:crypto";
import { headerKey, readCsv } from "./csv";
import type { Db } from "./facts-access";
import type { ParentRow } from "./facts-labels";
import { isEmail } from "./mail";

export const INVITE_DAYS = 7;
export type InviteMode = "new_account" | "existing_account";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
export const looksLikeInviteToken = (t: string) => /^[A-Za-z0-9_-]{40,60}$/.test(t);
export const normEmail = (s: string) => s.trim().toLowerCase();

// ---------------------------------------------------------------------------
// Panel list

export async function listParents(sql: Db, schoolId: number): Promise<ParentRow[]> {
  return sql<ParentRow[]>`
    select p.parent_facts_id as "parentId", p.email, u.email as "accountEmail",
      i.created_at::text as "invitedAt", i.expires_at::text as "expiresAt",
      case when p.user_id is not null then 'active'
           when i.id is null then 'pending_email'
           when i.used_at is null and i.cancelled_at is null and i.expires_at > now() then 'invited'
           else 'expired' end as status,
      (select count(*)::int from facts_student_access g where g.school_id = p.school_id and g.parent_facts_id = p.parent_facts_id and g.state = 'granted') as "studentsGranted",
      (select count(*)::int from facts_student_access g where g.school_id = p.school_id and g.parent_facts_id = p.parent_facts_id and g.state = 'conflict') as conflicts
    from facts_parents p
    left join auth_user u on u.id = p.user_id
    left join lateral (
      select * from facts_invitations x where x.school_id = p.school_id and x.parent_facts_id = p.parent_facts_id
      order by x.created_at desc, x.id desc limit 1) i on true
    where p.school_id = ${schoolId}
    order by p.parent_facts_id`;
}

// ---------------------------------------------------------------------------
// Creating invitations (panel field, resend and the emails CSV all come here)

export type InviteRequest = { parentId: string; email: string };
export type InviteCheck =
  | { kind: "invite"; parentId: string; email: string; mode: InviteMode }
  | { kind: "skip"; parentId: string; email: string; reason: string }
  | { kind: "error"; parentId: string; email: string; reason: string };

/**
 * Decides what to do with each (Parent ID, email) without writing anything.
 * skipIfInvited: an open invitation to the same email is not sent again (CSV re-import).
 */
export async function checkInvitations(sql: Db, schoolId: number, reqs: InviteRequest[], opts: { skipIfInvited: boolean }): Promise<InviteCheck[]> {
  if (!reqs.length) return [];
  const ids = reqs.map((r) => r.parentId);
  const emails = reqs.map((r) => normEmail(r.email));
  const parents = new Map(
    (await sql<{ parent_facts_id: string; verified: boolean; open_email: string | null }[]>`
      select p.parent_facts_id, p.user_id is not null as verified,
        (select i.email from facts_invitations i where i.school_id = p.school_id and i.parent_facts_id = p.parent_facts_id
           and i.used_at is null and i.cancelled_at is null and i.expires_at > now() order by i.created_at desc limit 1) as open_email
      from facts_parents p where p.school_id = ${schoolId} and p.parent_facts_id = any(${ids}::text[])`).map((r) => [r.parent_facts_id, r]),
  );
  // Emails already given to (or verified for) another Parent ID of this school.
  const taken = await sql<{ email: string; parent_facts_id: string }[]>`
    select lower(coalesce(u.email, p.email)) as email, p.parent_facts_id
    from facts_parents p left join auth_user u on u.id = p.user_id
    where p.school_id = ${schoolId} and lower(coalesce(u.email, p.email)) = any(${emails}::text[])`;
  const accounts = new Map(
    (await sql<{ email: string; id: string; other_school: boolean; linked_parent: string | null }[]>`
      select lower(u.email) as email, u.id,
        exists (select 1 from family_users f where f.user_id = u.id and f.school_id <> ${schoolId}) as other_school,
        (select p.parent_facts_id from facts_parents p where p.school_id = ${schoolId} and p.user_id = u.id) as linked_parent
      from auth_user u where lower(u.email) = any(${emails}::text[])`).map((r) => [r.email, r]),
  );

  return reqs.map((r): InviteCheck => {
    const email = normEmail(r.email);
    const base = { parentId: r.parentId, email };
    if (!isEmail(email)) return { kind: "error", ...base, reason: "The email is not valid." };
    const p = parents.get(r.parentId);
    if (p?.verified) return { kind: "skip", ...base, reason: "Already active. Nothing is sent." };
    const other = taken.find((t) => t.email === email && t.parent_facts_id !== r.parentId);
    if (other) return { kind: "error", ...base, reason: `This email is already used for Parent ID ${other.parent_facts_id}.` };
    const acc = accounts.get(email);
    if (acc?.linked_parent && acc.linked_parent !== r.parentId) return { kind: "error", ...base, reason: `This email's account is already linked to Parent ID ${acc.linked_parent}.` };
    if (acc?.other_school) return { kind: "error", ...base, reason: "This email cannot be used for this school's portal. Ask the parent for another email." };
    if (opts.skipIfInvited && p?.open_email === email) return { kind: "skip", ...base, reason: "Already invited with this email. Use “Resend” to send a new link." };
    return { kind: "invite", ...base, mode: acc ? "existing_account" : "new_account" };
  });
}

export type CreatedInvite = { parentId: string; email: string; mode: InviteMode; token: string };

/** Writes the invitations of checkInvitations() (kind "invite") in one transaction. Emails are sent by the caller after it. */
export async function createInvitations(
  sql: Db, schoolId: number, reqs: InviteRequest[], opts: { skipIfInvited: boolean; source: "panel" | "csv"; by: string },
): Promise<{ checks: InviteCheck[]; created: CreatedInvite[] }> {
  return (await sql.begin(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    await tx`select pg_advisory_xact_lock(hashtext(${`facts:${schoolId}`}))`;
    const checks = await checkInvitations(tx, schoolId, reqs, opts);
    const created: CreatedInvite[] = [];
    for (const c of checks) {
      if (c.kind !== "invite") continue;
      const token = randomBytes(32).toString("base64url");
      await tx`
        insert into facts_parents (school_id, parent_facts_id, email) values (${schoolId}, ${c.parentId}, ${c.email})
        on conflict (school_id, parent_facts_id) do update set email = excluded.email, updated_at = now()`;
      await tx`
        update facts_invitations set cancelled_at = now()
        where school_id = ${schoolId} and parent_facts_id = ${c.parentId} and used_at is null and cancelled_at is null`;
      await tx`
        insert into facts_invitations (school_id, parent_facts_id, email, token_hash, mode, source, expires_at, created_by)
        values (${schoolId}, ${c.parentId}, ${c.email}, ${hash(token)}, ${c.mode}, ${opts.source},
          now() + make_interval(days => ${INVITE_DAYS}), ${opts.by})`;
      created.push({ parentId: c.parentId, email: c.email, mode: c.mode, token });
    }
    return { checks, created };
  })) as { checks: InviteCheck[]; created: CreatedInvite[] };
}

// ---------------------------------------------------------------------------
// The emails CSV: "Parent Individual ID" and an email column.

const EMAIL_HEADERS = ["email", "e-mail", "email address", "e-mail address", "parent email", "parent e-mail", "parent email address"];

export type EmailRowIssue = { line: number; problem: string };
export type EmailsAnalysis = {
  error?: string;
  rowsRead: number;
  pairs: InviteRequest[];         // one per Parent ID, ready to check against the school
  invalid: EmailRowIssue[];       // empty id or badly written email
  duplicateRows: number;          // same ID and same email again (used once)
  idWithTwoEmails: { parentId: string; emails: string[] }[];
  emailWithTwoIds: { email: string; parentIds: string[] }[];
};

export function analyzeEmailsCsv(text: string): EmailsAnalysis {
  const empty: EmailsAnalysis = { rowsRead: 0, pairs: [], invalid: [], duplicateRows: 0, idWithTwoEmails: [], emailWithTwoIds: [] };
  const csv = readCsv(text);
  if (csv.error) return { ...empty, error: csv.error };
  if (!csv.records.length) return { ...empty, error: "The file is empty." };
  const head = csv.records[0].map(headerKey);
  const iP = head.indexOf(headerKey("Parent Individual ID"));
  const iE = head.findIndex((h) => EMAIL_HEADERS.includes(h));
  if (iP < 0 || iE < 0) return { ...empty, error: "The first row must name the columns “Parent Individual ID” and “Email”." };
  const rows = csv.records.slice(1);
  if (rows.length > 20_000) return { ...empty, error: `The file has ${rows.length} rows. The limit is 20000.` };

  const out: EmailsAnalysis = { ...empty, rowsRead: rows.length };
  const byId = new Map<string, Set<string>>();
  const byEmail = new Map<string, Set<string>>();
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const line = csv.lines[i + 1];
    const id = (r[iP] ?? "").trim();
    const email = normEmail(r[iE] ?? "");
    if (!id || id.length > 64) return out.invalid.push({ line, problem: id ? "“Parent Individual ID” is too long" : "“Parent Individual ID” is empty" });
    if (!isEmail(email)) return out.invalid.push({ line, problem: `Parent ${id}: “${email.slice(0, 60)}” is not a valid email` });
    const k = `${id}\u0000${email}`;
    if (seen.has(k)) { out.duplicateRows++; return; }
    seen.add(k);
    (byId.get(id) ?? byId.set(id, new Set()).get(id)!).add(email);
    (byEmail.get(email) ?? byEmail.set(email, new Set()).get(email)!).add(id);
  });
  const badIds = new Set<string>();
  for (const [id, es] of byId) if (es.size > 1) { out.idWithTwoEmails.push({ parentId: id, emails: [...es].sort() }); badIds.add(id); }
  for (const [email, ids] of byEmail) if (ids.size > 1) { out.emailWithTwoIds.push({ email, parentIds: [...ids].sort() }); ids.forEach((x) => badIds.add(x)); }
  for (const [id, es] of byId) if (!badIds.has(id)) out.pairs.push({ parentId: id, email: [...es][0] });
  out.pairs.sort((a, b) => a.parentId.localeCompare(b.parentId));
  return out;
}

// ---------------------------------------------------------------------------
// Using an invitation

export type OpenInvite = { id: number; parentId: string; email: string; accountExists: boolean };

/** Whether a link can still be used (to show the right form), without using it. */
export async function peekInvitation(sql: Db, schoolId: number, token: string): Promise<OpenInvite | null> {
  if (!looksLikeInviteToken(token)) return null;
  const [r] = await sql<OpenInvite[]>`
    select i.id, i.parent_facts_id as "parentId", i.email,
      exists (select 1 from auth_user u where lower(u.email) = i.email) as "accountExists"
    from facts_invitations i join facts_parents p on p.school_id = i.school_id and p.parent_facts_id = i.parent_facts_id
    where i.token_hash = ${hash(token)} and i.school_id = ${schoolId}
      and i.used_at is null and i.cancelled_at is null and i.expires_at > now() and p.user_id is null`;
  return r ?? null;
}

export type AcceptResult = { ok: true; userId: string } | { ok: false; error: string; code: "invalid" | "account_exists" | "no_account" | "cannot_link" | "failed" };
const INVALID: AcceptResult = { ok: false, code: "invalid", error: "This link has already been used, has expired or was replaced by a newer one. Ask the school office to send it again." };

/** Marks the link used in the same statement that checks it, so it works only once. */
async function claim(tx: Db, schoolId: number, token: string) {
  const [r] = await tx<{ id: number; parent_facts_id: string; email: string }[]>`
    update facts_invitations i set used_at = now()
    from facts_parents p
    where i.token_hash = ${hash(token)} and i.school_id = ${schoolId}
      and p.school_id = i.school_id and p.parent_facts_id = i.parent_facts_id and p.user_id is null
      and i.used_at is null and i.cancelled_at is null and i.expires_at > now()
    returning i.id, i.parent_facts_id, i.email`;
  return r ?? null;
}

async function verify(tx: Db, schoolId: number, parentId: string, userId: string, via: InviteMode) {
  const [linked] = await tx<{ parent_facts_id: string }[]>`
    select parent_facts_id from facts_parents where school_id = ${schoolId} and user_id = ${userId} and parent_facts_id <> ${parentId}`;
  if (linked) throw new LinkError("This account is already linked to another FACTS parent of the school. Contact the school office.");
  const done = await tx`
    update facts_parents set user_id = ${userId}, verified_at = now(), verified_via = ${via}, updated_at = now()
    where school_id = ${schoolId} and parent_facts_id = ${parentId} and user_id is null`;
  if (!done.count) throw new LinkError("This FACTS parent is already linked to an account.");
}

class LinkError extends Error {}

/**
 * Puts an account that has no family in this school into the family of its FACTS
 * parent (the family the school created from FACTS, lowest Family ID first). If
 * there is none, the account gets a family of its own, approved, as before.
 * Returns the status of that family.
 */
async function joinFamily(tx: Db, schoolId: number, parentId: string, userId: string, name: string): Promise<string> {
  const [fam] = await tx<{ id: number; status: string }[]>`
    select f.id, f.status from facts_family_parents fp
    join families f on f.school_id = fp.school_id and f.facts_family_id = fp.family_facts_id
    where fp.school_id = ${schoolId} and fp.parent_facts_id = ${parentId}
    order by length(f.facts_family_id), f.facts_family_id limit 1`;
  if (fam) {
    await tx`insert into family_users (family_id, user_id, school_id) values (${fam.id}, ${userId}, ${schoolId})`;
    if (fam.status !== "pending") return fam.status;
    await tx`update families set status = 'approved', decided_at = now(), decided_by = 'FACTS invitation' where id = ${fam.id}`;
    return "approved";
  }
  await tx`
    with f as (
      insert into families (school_id, user_id, name, status, decided_at, decided_by)
      values (${schoolId}, ${userId}, ${name}, 'approved', now(), 'FACTS invitation') returning id)
    insert into family_users (family_id, user_id, school_id) select id, ${userId}, ${schoolId} from f`;
  return "approved";
}
class InvalidLink extends Error {}

/**
 * New account. createUser makes the sign-in (Better Auth) and returns its id; it
 * runs only after the link is claimed. Any failure afterwards gives the link back.
 */
export async function acceptAsNewAccount(
  sql: Db, schoolId: number, token: string, familyName: string,
  createUser: (email: string) => Promise<string>, deleteUser: (userId: string) => Promise<void>,
): Promise<AcceptResult> {
  const open = await peekInvitation(sql, schoolId, token);
  if (!open) return INVALID;
  if (open.accountExists) return { ok: false, code: "account_exists", error: "There is already an account with this email. Confirm with its password instead." };
  const c = await claim(sql, schoolId, token);
  if (!c) return INVALID;
  let userId: string | null = null;
  try {
    userId = await createUser(c.email);
    const uid = userId;
    await sql.begin(async (txRaw) => {
      const tx = txRaw as unknown as Db;
      await joinFamily(tx, schoolId, c.parent_facts_id, uid, familyName);
      await verify(tx, schoolId, c.parent_facts_id, uid, "new_account");
      await tx`update auth_user set email_verified = true, updated_at = now() where id = ${uid}`;
    });
    return { ok: true, userId: uid };
  } catch (e) {
    if (userId) await deleteUser(userId).catch(() => {});
    await sql`update facts_invitations set used_at = null where id = ${c.id}`.catch(() => {});
    return { ok: false, code: e instanceof LinkError ? "cannot_link" : "failed", error: e instanceof LinkError ? e.message : "The account could not be created. Try again in a moment." };
  }
}

/**
 * Existing account with the invitation's email: checkPassword must confirm it is
 * the owner (the caller limits attempts). The family row of this school is created
 * (approved) if missing; a pending one is approved, as the school sent the invitation;
 * a rejected or turned-off one stays as it is.
 */
export async function acceptAsExistingAccount(
  sql: Db, schoolId: number, token: string, checkPassword: (userId: string) => Promise<boolean>,
): Promise<AcceptResult & { familyStatus?: string }> {
  const open = await peekInvitation(sql, schoolId, token);
  if (!open) return INVALID;
  const [u] = await sql<{ id: string; name: string; other_school: boolean }[]>`
    select u.id, u.name, exists (select 1 from family_users f where f.user_id = u.id and f.school_id <> ${schoolId}) as other_school
    from auth_user u where lower(u.email) = ${open.email}`;
  if (!u) return { ok: false, code: "no_account", error: "There is no account with this email yet. Create one with this link." };
  if (!(await checkPassword(u.id))) return { ok: false, code: "failed", error: "The password is not right." };
  if (u.other_school) return { ok: false, code: "cannot_link", error: "This account belongs to another school's portal. Contact the school office." };
  try {
    const status = await sql.begin(async (txRaw) => {
      const tx = txRaw as unknown as Db;
      const c = await claim(tx, schoolId, token);
      if (!c) throw new InvalidLink();
      await verify(tx, schoolId, c.parent_facts_id, u.id, "existing_account");
      const [f] = await tx<{ id: number; status: string }[]>`
        select f.id, f.status from family_users fu join families f on f.id = fu.family_id where fu.user_id = ${u.id} and fu.school_id = ${schoolId}`;
      if (!f) return joinFamily(tx, schoolId, c.parent_facts_id, u.id, u.name || open.email);
      if (f.status === "pending") {
        await tx`update families set status = 'approved', decided_at = now(), decided_by = 'FACTS invitation' where id = ${f.id}`;
        return "approved";
      }
      return f.status;
    });
    return { ok: true, userId: u.id, familyStatus: status as string };
  } catch (e) {
    if (e instanceof InvalidLink) return INVALID;
    return { ok: false, code: e instanceof LinkError ? "cannot_link" : "failed", error: e instanceof LinkError ? e.message : "Something went wrong. Try again." };
  }
}
