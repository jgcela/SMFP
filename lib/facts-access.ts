// FACTS "Parents Web" access import.
//
// The FACTS report has one row per (student, parent) with these columns (exact
// headers): "Student ID (System)", "LastName, FirstName", "Grade Level",
// "Family ID", "Family Name", "Family Order", "Has access to Parents Web",
// "Parent Individual ID".
//
// Only four are read: Student ID (System), Parent Individual ID, Family ID and
// Has access to Parents Web. Names, grade and Family Order are never read, stored
// or logged. All ids are kept as text, exactly as written (after trimming).
//
// A link is school + Parent Individual ID + Student ID (System):
//   Yes            -> granted   (the adult may see the student once their account is verified)
//   No             -> denied    (also revokes an earlier Yes)
//   Yes and No     -> conflict  (no access; an earlier Yes is suspended until a later file is consistent)
//   empty id / any other value -> invalid row, never read as Yes; the link is left unchanged
//   missing from the file      -> left unchanged (the report may be partial)
// Family ID only groups students into FACTS families (kept separately); it never grants access.
//
// The functions take the database client as a parameter so they can run inside
// one transaction and be tested against a throwaway database.
import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import { headerKey, readCsv } from "./csv";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = Sql<any>;

export const FACTS_HEADERS = {
  student: "Student ID (System)",
  parent: "Parent Individual ID",
  family: "Family ID",
  access: "Has access to Parents Web",
} as const;

export const MAX_BYTES = 5 * 1024 * 1024;
export const MAX_ROWS = 50_000;
const MAX_ID = 64;

export type AccessState = "granted" | "denied" | "conflict";
export type RowIssue = { line: number; problem: string };
export type LinkId = { parent: string; student: string };

type LinkAcc = LinkId & { yes: number; no: number; blocked: boolean };

export type AccessAnalysis = {
  error?: string;
  rowsRead: number;
  links: Map<string, LinkAcc>;
  invalid: RowIssue[];
  duplicateRows: number; // rows that repeat a link with the same value (applied once)
  familyStudents: Map<string, { family: string; student: string }>;
};

const key = (a: string, b: string) => `${a}\u0000${b}`;

/** Checks one id: text, not empty, no control characters, at most 64 characters. */
function idProblem(v: string, name: string): string | null {
  if (!v) return `“${name}” is empty`;
  if (v.length > MAX_ID) return `“${name}” is longer than ${MAX_ID} characters`;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(v)) return `“${name}” has invisible characters`;
  return null;
}

/** "Yes" / "No" (any capitals, spaces around ignored). Anything else is invalid. */
export function accessValue(raw: string): "yes" | "no" | null {
  const v = raw.trim().toLowerCase();
  return v === "yes" ? "yes" : v === "no" ? "no" : null;
}

/** True if a file's header row is a FACTS access report (used to tell CSV formats apart). */
export function looksLikeFactsAccess(headers: string[]) {
  const h = new Set(headers.map(headerKey));
  return h.has(headerKey(FACTS_HEADERS.student)) && h.has(headerKey(FACTS_HEADERS.parent));
}

export function analyzeAccessCsv(text: string): AccessAnalysis {
  const empty: AccessAnalysis = { rowsRead: 0, links: new Map(), invalid: [], duplicateRows: 0, familyStudents: new Map() };
  const csv = readCsv(text);
  if (csv.error) return { ...empty, error: csv.error };
  if (!csv.records.length) return { ...empty, error: "The file is empty." };
  const head = csv.records[0].map(headerKey);
  const col = (name: string) => head.indexOf(headerKey(name));
  const missing = Object.values(FACTS_HEADERS).filter((n) => col(n) < 0);
  if (missing.length) {
    return { ...empty, error: `The file does not have the column${missing.length > 1 ? "s" : ""} ${missing.map((m) => `“${m}”`).join(", ")}. Export the FACTS report with its column names in the first row.` };
  }
  const iS = col(FACTS_HEADERS.student), iP = col(FACTS_HEADERS.parent), iF = col(FACTS_HEADERS.family), iA = col(FACTS_HEADERS.access);
  const rows = csv.records.slice(1);
  if (rows.length > MAX_ROWS) return { ...empty, error: `The file has ${rows.length} rows. The limit is ${MAX_ROWS}.` };

  const out: AccessAnalysis = { ...empty, rowsRead: rows.length };
  rows.forEach((r, i) => {
    const line = csv.lines[i + 1];
    const student = (r[iS] ?? "").trim(), parent = (r[iP] ?? "").trim(), family = (r[iF] ?? "").trim(), rawAccess = r[iA] ?? "";
    const idIssues = [idProblem(student, FACTS_HEADERS.student), idProblem(parent, FACTS_HEADERS.parent), idProblem(family, FACTS_HEADERS.family)].filter(Boolean);
    const value = accessValue(rawAccess);
    if (idIssues.length) {
      out.invalid.push({ line, problem: idIssues.join("; ") + (value ? "" : `; “${FACTS_HEADERS.access}” is “${rawAccess.trim().slice(0, 20)}”, not Yes or No`) });
      return; // cannot be tied to a link: nothing changes
    }
    out.familyStudents.set(key(family, student), { family, student });
    const k = key(parent, student);
    const link = out.links.get(k) ?? { parent, student, yes: 0, no: 0, blocked: false };
    out.links.set(k, link);
    if (!value) {
      // Never read as Yes. The whole link is left as it is until the file is fixed.
      link.blocked = true;
      out.invalid.push({ line, problem: `Parent ${parent}, student ${student}: “${FACTS_HEADERS.access}” is “${rawAccess.trim().slice(0, 20)}”, not Yes or No` });
      return;
    }
    if ((value === "yes" ? link.yes : link.no) > 0) out.duplicateRows++;
    if (value === "yes") link.yes++; else link.no++;
  });
  return out;
}

/** What the file asks for one link, or null when the link must not be touched. */
export function targetState(l: LinkAcc): AccessState | null {
  if (l.blocked) return null;
  if (l.yes && l.no) return "conflict";
  if (l.yes) return "granted";
  if (l.no) return "denied";
  return null;
}

export type Change = LinkId & { from: AccessState | null; to: AccessState };

export type AccessPlan = {
  error?: string;
  rowsRead: number;
  uniqueLinks: number;
  invalidRows: RowIssue[];
  invalidLinks: number;       // links left unchanged because of an invalid Yes/No value
  duplicateRows: number;
  conflicts: (LinkId & { suspends: boolean })[];
  activate: number;           // links that become "granted"
  activateNow: number;        //   ...whose adult already has a verified account (access starts now)
  activatePending: number;    //   ...waiting for the adult's account to be verified
  revoke: number;             // granted -> denied
  suspend: number;            // granted -> conflict
  newWithoutAccess: number;   // new links stored as denied (nothing changes for anyone)
  unchanged: number;
  pendingParents: string[];   // Parent IDs with at least one Yes in the file and no verified account
  studentsWithoutChild: number; // Student IDs with a Yes in the file not matched to a child in the portal
  newFamilyStudents: number;
  changes: Change[];
  fingerprint: string;
};

/** Compares the file with what the school has now. Reads only. */
export async function planAccessImport(sql: Db, schoolId: number, a: AccessAnalysis): Promise<AccessPlan> {
  const links = [...a.links.values()];
  const parents = [...new Set(links.map((l) => l.parent))];
  const students = [...new Set(links.map((l) => l.student))];

  const current = new Map<string, AccessState>();
  if (links.length) {
    const rows = await sql<{ parent_facts_id: string; student_facts_id: string; state: AccessState }[]>`
      select parent_facts_id, student_facts_id, state from facts_student_access
      where school_id = ${schoolId} and parent_facts_id = any(${parents}::text[])`;
    for (const r of rows) current.set(key(r.parent_facts_id, r.student_facts_id), r.state);
  }
  const verified = new Set(
    parents.length
      ? (await sql<{ parent_facts_id: string }[]>`
          select parent_facts_id from facts_parents
          where school_id = ${schoolId} and parent_facts_id = any(${parents}::text[]) and user_id is not null`).map((r) => r.parent_facts_id)
      : [],
  );
  const knownStudents = new Set(
    students.length
      ? (await sql<{ facts_id: string }[]>`
          select facts_id from children where school_id = ${schoolId} and facts_id = any(${students}::text[])`).map((r) => r.facts_id)
      : [],
  );
  let newFamilyStudents = 0;
  const fs = [...a.familyStudents.values()];
  if (fs.length) {
    const [r] = await sql<{ n: number }[]>`
      select count(*)::int as n from unnest(${fs.map((x) => x.family)}::text[], ${fs.map((x) => x.student)}::text[]) as t(f, s)
      where not exists (select 1 from facts_family_students x where x.school_id = ${schoolId} and x.family_facts_id = t.f and x.student_facts_id = t.s)`;
    newFamilyStudents = r.n;
  }

  const plan: AccessPlan = {
    rowsRead: a.rowsRead, uniqueLinks: links.length, invalidRows: a.invalid, invalidLinks: 0, duplicateRows: a.duplicateRows,
    conflicts: [], activate: 0, activateNow: 0, activatePending: 0, revoke: 0, suspend: 0, newWithoutAccess: 0, unchanged: 0,
    pendingParents: [], studentsWithoutChild: 0, newFamilyStudents, changes: [], fingerprint: "",
  };
  const pending = new Set<string>();
  const unmatched = new Set<string>();
  for (const l of links) {
    const to = targetState(l);
    if (!to) { plan.invalidLinks++; continue; }
    const from = current.get(key(l.parent, l.student)) ?? null;
    if (to === "conflict") plan.conflicts.push({ parent: l.parent, student: l.student, suspends: from === "granted" });
    if (to === "granted") {
      if (!verified.has(l.parent)) pending.add(l.parent);
      if (!knownStudents.has(l.student)) unmatched.add(l.student);
    }
    if (from === to) { plan.unchanged++; continue; }
    plan.changes.push({ parent: l.parent, student: l.student, from, to });
    if (to === "granted") {
      plan.activate++;
      if (verified.has(l.parent)) plan.activateNow++; else plan.activatePending++;
    } else if (from === "granted") {
      if (to === "denied") plan.revoke++; else plan.suspend++;
    } else if (from === null && to === "denied") plan.newWithoutAccess++;
  }
  plan.pendingParents = [...pending].sort();
  plan.studentsWithoutChild = unmatched.size;
  plan.changes.sort((x, y) => x.parent.localeCompare(y.parent) || x.student.localeCompare(y.student));
  plan.fingerprint = createHash("sha256")
    .update(JSON.stringify([plan.changes.map((c) => [c.parent, c.student, c.from, c.to]), newFamilyStudents]))
    .digest("hex");
  return plan;
}

export const fileHash = (text: string) => createHash("sha256").update(text).digest("hex");

/** The numbers kept for an import (no names, no ids). */
export function planSummary(p: AccessPlan) {
  return {
    rowsRead: p.rowsRead, uniqueLinks: p.uniqueLinks, invalidRows: p.invalidRows.length, invalidLinks: p.invalidLinks,
    duplicateRows: p.duplicateRows, conflicts: p.conflicts.length, activate: p.activate, activateNow: p.activateNow,
    activatePending: p.activatePending, revoke: p.revoke, suspend: p.suspend, newWithoutAccess: p.newWithoutAccess,
    unchanged: p.unchanged, pendingParents: p.pendingParents.length, studentsWithoutChild: p.studentsWithoutChild,
    newFamilyStudents: p.newFamilyStudents,
  };
}

export type ApplyResult = { error?: string; stale?: boolean; plan?: AccessPlan; importId?: number };

/**
 * Applies the file in one transaction. The plan is computed again inside the
 * transaction (with the school's FACTS lock held) and must match the preview the
 * school saw (expectedFingerprint); otherwise nothing is written and the school
 * is asked to look at the preview again. Re-importing the same file changes nothing.
 */
export async function applyAccessImport(
  sql: Db, schoolId: number, text: string, expectedFingerprint: string, by: string,
): Promise<ApplyResult> {
  const a = analyzeAccessCsv(text);
  if (a.error) return { error: a.error };
  return (await sql.begin(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    await tx`select pg_advisory_xact_lock(hashtext(${`facts:${schoolId}`}))`;
    const plan = await planAccessImport(tx, schoolId, a);
    if (plan.fingerprint !== expectedFingerprint) return { stale: true, plan };

    // Parents of links that the file actually decides (not of invalid ones).
    const parents = [...new Set([...a.links.values()].filter((l) => targetState(l)).map((l) => l.parent))];
    if (parents.length) {
      await tx`
        insert into facts_parents (school_id, parent_facts_id)
        select ${schoolId}, p from unnest(${parents}::text[]) as p
        on conflict do nothing`;
    }
    const [imp] = await tx<{ id: number }[]>`
      insert into facts_imports (school_id, kind, file_sha256, summary, created_by)
      values (${schoolId}, 'access', ${fileHash(text)}, ${tx.json(planSummary(plan))}, ${by}) returning id`;
    if (plan.changes.length) {
      await tx`
        insert into facts_student_access (school_id, parent_facts_id, student_facts_id, state, changed_at, import_id)
        select ${schoolId}, p, s, st, now(), ${imp.id}
        from unnest(${plan.changes.map((c) => c.parent)}::text[], ${plan.changes.map((c) => c.student)}::text[], ${plan.changes.map((c) => c.to)}::text[]) as t(p, s, st)
        on conflict (school_id, parent_facts_id, student_facts_id)
        do update set state = excluded.state, changed_at = now(), import_id = excluded.import_id
        where facts_student_access.state <> excluded.state`;
    }
    const fs = [...a.familyStudents.values()];
    if (fs.length) {
      await tx`
        insert into facts_family_students (school_id, family_facts_id, student_facts_id)
        select ${schoolId}, f, s from unnest(${fs.map((x) => x.family)}::text[], ${fs.map((x) => x.student)}::text[]) as t(f, s)
        on conflict do nothing`;
    }
    return { plan, importId: imp.id };
  })) as ApplyResult;
}
