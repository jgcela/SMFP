"use server";
// FACTS access in the staff panel: import the FACTS "Parents Web" report, import
// a file of parent emails, and invite / re-invite one parent. Only staff of this
// school; every query is limited to the school of the address (staff.schoolId).
// Nothing is saved by a preview. The access import reads no names, grades or
// Family Order; the families import (provisional, until a direct FACTS
// connection) reads student and family names and grades, never Family Order.
import { revalidatePath } from "next/cache";
import { db } from "../../../../lib/db";
import { portalOrigin, sendSchoolMail } from "../../../../lib/emails";
import {
  analyzeAccessCsv, applyAccessImport, MAX_BYTES, planAccessImport, planSummary, type AccessPlan, type Db, type RowIssue,
} from "../../../../lib/facts-access";
import {
  analyzeEmailsCsv, checkInvitations, createInvitations, normEmail, type CreatedInvite, type InviteCheck,
} from "../../../../lib/facts-accounts";
import {
  analyzeFamiliesCsv, applyFamiliesImport, familiesSummary, planFamiliesImport, type FamiliesPlan, type GradeMap, type StudentIssue,
} from "../../../../lib/facts-families";
import { schoolPath } from "../../../../lib/portal";
import { requireStaff, type Staff } from "../../../../lib/staff";
import { requirePanelModule } from "../../../../lib/years";

const sql = () => db() as unknown as Db;
const LIST = 200; // rows of each list shown in a preview
const fail = (e: unknown) => ({ error: e instanceof Error ? e.message : "Something went wrong. Try again." });

async function staffHere(): Promise<Staff> {
  await requirePanelModule("families");
  return requireStaff();
}

async function readFile(fd: FormData): Promise<{ text: string; name: string } | { error: string }> {
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return { error: "Choose a .csv file." };
  if (file.size > MAX_BYTES) return { error: "The file is larger than 5 MB." };
  if (!/\.(csv|txt)$/i.test(file.name)) return { error: "Only .csv files can be imported. In FACTS or Excel, save the report as CSV." };
  return { text: await file.text(), name: file.name };
}

// ---------------------------------------------------------------------------
// FACTS access report

export type AccessPreview = {
  error?: string; stale?: boolean; done?: boolean; fileName?: string; fingerprint?: string;
  summary?: ReturnType<typeof planSummary>;
  invalidRows?: RowIssue[];
  conflicts?: AccessPlan["conflicts"];
  pendingParents?: string[];
};

function toPreview(plan: AccessPlan, fileName: string): AccessPreview {
  return {
    fileName, fingerprint: plan.fingerprint, summary: planSummary(plan),
    invalidRows: plan.invalidRows.slice(0, LIST), conflicts: plan.conflicts.slice(0, LIST), pendingParents: plan.pendingParents.slice(0, LIST),
  };
}

export async function previewAccess(_prev: AccessPreview | undefined, fd: FormData): Promise<AccessPreview> {
  try {
    const staff = await staffHere();
    const f = await readFile(fd);
    if ("error" in f) return { error: f.error };
    const a = analyzeAccessCsv(f.text);
    if (a.error) return { error: a.error };
    return toPreview(await planAccessImport(sql(), staff.schoolId, a), f.name);
  } catch (e) { return fail(e); }
}

/** Saves the file the school previewed, all or nothing. */
export async function applyAccess(fd: FormData): Promise<AccessPreview> {
  try {
    const staff = await staffHere();
    const f = await readFile(fd);
    if ("error" in f) return { error: f.error };
    const r = await applyAccessImport(sql(), staff.schoolId, f.text, String(fd.get("fingerprint") ?? ""), staff.name || staff.email);
    if (r.error) return { error: r.error };
    if (r.stale && r.plan) return { ...toPreview(r.plan, f.name), stale: true };
    revalidatePath("/admin/families/facts");
    revalidatePath("/family");
    return { ...toPreview(r.plan!, f.name), done: true };
  } catch (e) { return fail(e); }
}

// ---------------------------------------------------------------------------
// Invitations

async function sendInvites(staff: Staff, created: CreatedInvite[]) {
  const base = `${await portalOrigin()}${await schoolPath("/family/invite")}`;
  let sent = 0;
  for (const c of created) {
    const link = `${base}?token=${c.token}`;
    if (await sendSchoolMail(staff.schoolId, c.mode === "new_account" ? "factsInvite" : "factsConfirm", c.email, link)) sent++;
  }
  return sent;
}

export type InviteResult = { ok?: string; error?: string };

/** The field next to a Parent ID, and the "Resend" button (email empty = the one on file). */
export async function inviteParent(parentId: string, emailIn: string): Promise<InviteResult> {
  try {
    const staff = await staffHere();
    const id = String(parentId ?? "").trim();
    let email = normEmail(String(emailIn ?? ""));
    if (!id) return { error: "This parent is no longer in the list. Reload the page." };
    const [p] = await db()<{ email: string | null }[]>`select email from facts_parents where school_id = ${staff.schoolId} and parent_facts_id = ${id}`;
    if (!p) return { error: "This parent is no longer in the list. Reload the page." };
    if (!email) email = p.email ?? "";
    if (!email) return { error: "Write the parent's email." };
    const { checks, created } = await createInvitations(sql(), staff.schoolId, [{ parentId: id, email }], { skipIfInvited: false, source: "panel", by: staff.name || staff.email });
    const c = checks[0];
    if (c.kind !== "invite") return { error: c.reason };
    const sent = await sendInvites(staff, created);
    revalidatePath("/admin/families/facts");
    return sent
      ? { ok: `Invitation sent to ${email}. The link works for 7 days.` }
      : { error: `The invitation for ${email} is saved, but the email could not be sent. Try “Resend” later.` };
  } catch (e) { return fail(e); }
}

// ---------------------------------------------------------------------------
// Emails file ("Parent Individual ID" + email)

export type EmailsPreview = {
  error?: string; done?: boolean; fileName?: string; sent?: number;
  rowsRead?: number; duplicateRows?: number;
  invalid?: { line: number; problem: string }[];
  idWithTwoEmails?: { parentId: string; emails: string[] }[];
  emailWithTwoIds?: { email: string; parentIds: string[] }[];
  invite?: { parentId: string; email: string; mode: string }[];
  skipped?: { parentId: string; email: string; reason: string }[];
  refused?: { parentId: string; email: string; reason: string }[];
};

function emailsPreview(a: ReturnType<typeof analyzeEmailsCsv>, checks: InviteCheck[], fileName: string): EmailsPreview {
  return {
    fileName, rowsRead: a.rowsRead, duplicateRows: a.duplicateRows,
    invalid: a.invalid.slice(0, LIST), idWithTwoEmails: a.idWithTwoEmails.slice(0, LIST), emailWithTwoIds: a.emailWithTwoIds.slice(0, LIST),
    invite: checks.filter((c) => c.kind === "invite").map((c) => ({ parentId: c.parentId, email: c.email, mode: c.kind === "invite" ? c.mode : "" })),
    skipped: checks.filter((c) => c.kind === "skip").map((c) => ({ parentId: c.parentId, email: c.email, reason: "reason" in c ? c.reason : "" })).slice(0, LIST),
    refused: checks.filter((c) => c.kind === "error").map((c) => ({ parentId: c.parentId, email: c.email, reason: "reason" in c ? c.reason : "" })).slice(0, LIST),
  };
}

export async function previewEmails(_prev: EmailsPreview | undefined, fd: FormData): Promise<EmailsPreview> {
  try {
    const staff = await staffHere();
    const f = await readFile(fd);
    if ("error" in f) return { error: f.error };
    const a = analyzeEmailsCsv(f.text);
    if (a.error) return { error: a.error };
    const checks = await checkInvitations(sql(), staff.schoolId, a.pairs, { skipIfInvited: true });
    return emailsPreview(a, checks, f.name);
  } catch (e) { return fail(e); }
}

export async function applyEmails(fd: FormData): Promise<EmailsPreview> {
  try {
    const staff = await staffHere();
    const f = await readFile(fd);
    if ("error" in f) return { error: f.error };
    const a = analyzeEmailsCsv(f.text);
    if (a.error) return { error: a.error };
    const { checks, created } = await createInvitations(sql(), staff.schoolId, a.pairs, { skipIfInvited: true, source: "csv", by: staff.name || staff.email });
    const sent = await sendInvites(staff, created);
    revalidatePath("/admin/families/facts");
    return { ...emailsPreview(a, checks, f.name), done: true, sent };
  } catch (e) { return fail(e); }
}

// ---------------------------------------------------------------------------
// Families and students (same FACTS report)

export type FamiliesPreview = {
  error?: string; stale?: boolean; done?: boolean; fileName?: string; fingerprint?: string;
  summary?: ReturnType<typeof familiesSummary>;
  grades?: FamiliesPlan["grades"];
  schoolGrades?: string[];
  invalidRows?: RowIssue[];
  issues?: StudentIssue[];
};

function readMap(fd: FormData): GradeMap | null {
  const raw = fd.get("grades");
  if (typeof raw !== "string" || !raw) return null;
  try {
    const m = JSON.parse(raw) as unknown;
    if (!m || typeof m !== "object") return null;
    const out: GradeMap = {};
    for (const [k, v] of Object.entries(m as Record<string, unknown>)) if (typeof v === "string" && v.trim()) out[k.slice(0, 40)] = v.trim().slice(0, 40);
    return out;
  } catch { return null; }
}

async function familiesPreview(plan: FamiliesPlan, schoolId: number, fileName: string): Promise<FamiliesPreview> {
  const [s] = await db()<{ grades: string[] }[]>`select grades from schools where id = ${schoolId}`;
  return {
    fileName, fingerprint: plan.fingerprint, summary: familiesSummary(plan), grades: plan.grades, schoolGrades: s?.grades ?? [],
    invalidRows: plan.invalidRows.slice(0, LIST), issues: plan.issues.slice(0, LIST),
  };
}

/** Also used when the school changes how a grade reads: the preview is made again. */
export async function previewFamilies(_prev: FamiliesPreview | undefined, fd: FormData): Promise<FamiliesPreview> {
  try {
    const staff = await staffHere();
    const f = await readFile(fd);
    if ("error" in f) return { error: f.error };
    const a = analyzeFamiliesCsv(f.text);
    if (a.error) return { error: a.error };
    return familiesPreview(await planFamiliesImport(sql(), staff.schoolId, a, readMap(fd)), staff.schoolId, f.name);
  } catch (e) { return fail(e); }
}

export async function applyFamilies(fd: FormData): Promise<FamiliesPreview> {
  try {
    const staff = await staffHere();
    const f = await readFile(fd);
    if ("error" in f) return { error: f.error };
    const r = await applyFamiliesImport(sql(), staff.schoolId, f.text, readMap(fd) ?? {}, String(fd.get("fingerprint") ?? ""), staff.name || staff.email);
    if (r.error) return { error: r.error };
    if (r.stale && r.plan) return { ...(await familiesPreview(r.plan, staff.schoolId, f.name)), stale: true };
    revalidatePath("/admin/families");
    revalidatePath("/admin/families/facts");
    revalidatePath("/family");
    return { ...(await familiesPreview(r.plan!, staff.schoolId, f.name)), done: true };
  } catch (e) { return fail(e); }
}
