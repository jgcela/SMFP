// FACTS families and students import. PROVISIONAL: the school asked to create its
// families and children from the FACTS report until the portal has a direct
// connection to FACTS. It reads the same report as lib/facts-access.ts.
//
// Columns read: Student ID (System), "LastName, FirstName", Grade Level,
// Family ID, Family Name, Parent Individual ID. Family Order and
// "Has access to Parents Web" are not read here (access is lib/facts-access.ts).
//
// What it does (all or nothing, after a preview):
//   - each FACTS family becomes a family of the portal (families.facts_family_id),
//     approved, without an account; a renamed family gets the new name.
//   - each student becomes a child (children.facts_id) with name and grade, in its
//     FACTS family. A student in two families is placed in the first one (lowest
//     Family ID) and is listed under both in the panel. An existing child with the
//     same FACTS Student ID keeps its family; its name and grade follow FACTS.
//   - which Parent IDs belong to which family (ids only), so an invited parent
//     joins their family when they accept.
// Missing from a later file = left as it is (nothing is deleted).
// Who SEES each child is still decided only by FACTS access (lib/student-access.ts).
import { createHash } from "node:crypto";
import { headerKey, readCsv } from "./csv";
import { FACTS_HEADERS, MAX_BYTES, MAX_ROWS, type Db, type RowIssue } from "./facts-access";

export { MAX_BYTES };

export const FAMILY_HEADERS = {
  student: FACTS_HEADERS.student,
  name: "LastName, FirstName",
  grade: "Grade Level",
  family: FACTS_HEADERS.family,
  familyName: "Family Name",
  parent: FACTS_HEADERS.parent,
} as const;

const MAX_ID = 64;
const MAX_NAME = 100;
const MAX_GRADE = 40;
const key = (a: string, b: string) => `${a}\u0000${b}`;
// eslint-disable-next-line no-control-regex
const clean = (v: string) => v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
/** Numeric ids in number order ("9" before "10"), others after, as text. */
const idOrder = (a: string, b: string) => (a.length - b.length) || (a < b ? -1 : a > b ? 1 : 0);

/** "Pérez García, Ana María" -> "Ana María Pérez García". Without a comma, as written. */
export function displayName(raw: string) {
  const v = clean(raw);
  const i = v.indexOf(",");
  if (i < 0) return v;
  const last = v.slice(0, i).trim(), first = v.slice(i + 1).trim();
  return [first, last].filter(Boolean).join(" ");
}

type StudentAcc = { id: string; names: Set<string>; grades: Set<string>; families: Set<string> };
type FamilyAcc = { id: string; names: Set<string> };

export type FamiliesAnalysis = {
  error?: string;
  rowsRead: number;
  invalid: RowIssue[];
  students: Map<string, StudentAcc>;
  families: Map<string, FamilyAcc>;
  familyParents: Map<string, { family: string; parent: string }>;
};

export function analyzeFamiliesCsv(text: string): FamiliesAnalysis {
  const empty: FamiliesAnalysis = { rowsRead: 0, invalid: [], students: new Map(), families: new Map(), familyParents: new Map() };
  const csv = readCsv(text);
  if (csv.error) return { ...empty, error: csv.error };
  if (!csv.records.length) return { ...empty, error: "The file is empty." };
  const head = csv.records[0].map(headerKey);
  const col = (name: string) => head.indexOf(headerKey(name));
  const missing = Object.values(FAMILY_HEADERS).filter((n) => col(n) < 0);
  if (missing.length) {
    return { ...empty, error: `The file does not have the column${missing.length > 1 ? "s" : ""} ${missing.map((m) => `“${m}”`).join(", ")}. Export the FACTS report with its column names in the first row.` };
  }
  const iS = col(FAMILY_HEADERS.student), iN = col(FAMILY_HEADERS.name), iG = col(FAMILY_HEADERS.grade);
  const iF = col(FAMILY_HEADERS.family), iFN = col(FAMILY_HEADERS.familyName), iP = col(FAMILY_HEADERS.parent);
  const rows = csv.records.slice(1);
  if (rows.length > MAX_ROWS) return { ...empty, error: `The file has ${rows.length} rows. The limit is ${MAX_ROWS}.` };

  const out: FamiliesAnalysis = { ...empty, rowsRead: rows.length };
  rows.forEach((r, i) => {
    const line = csv.lines[i + 1];
    const student = (r[iS] ?? "").trim(), family = (r[iF] ?? "").trim(), parent = (r[iP] ?? "").trim();
    const name = displayName(r[iN] ?? ""), grade = clean(r[iG] ?? ""), familyName = clean(r[iFN] ?? "");
    const problems: string[] = [];
    for (const [v, h] of [[student, FAMILY_HEADERS.student], [family, FAMILY_HEADERS.family]] as const) {
      if (!v) problems.push(`“${h}” is empty`);
      else if (v.length > MAX_ID || /\s/.test(v)) problems.push(`“${h}” is not a valid id`);
    }
    if (parent && (parent.length > MAX_ID || /\s/.test(parent))) problems.push(`“${FAMILY_HEADERS.parent}” is not a valid id`);
    if (problems.length) { out.invalid.push({ line, problem: problems.join("; ") }); return; }

    const s = out.students.get(student) ?? { id: student, names: new Set(), grades: new Set(), families: new Set() };
    out.students.set(student, s);
    if (name) s.names.add(name.slice(0, MAX_NAME));
    if (grade) s.grades.add(grade.slice(0, MAX_GRADE));
    s.families.add(family);
    const f = out.families.get(family) ?? { id: family, names: new Set() };
    out.families.set(family, f);
    if (familyName) f.names.add(familyName.slice(0, MAX_NAME));
    if (parent) out.familyParents.set(key(family, parent), { family, parent });
  });
  return out;
}

// ---- Grades ----------------------------------------------------------------

const ORD = ["1st", "2nd", "3rd"];
const ordinal = (n: number) => (n >= 1 && n <= 3 ? ORD[n - 1] : `${n}th`);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** A first guess for a FACTS grade code, only if it names one of the school's grades. */
export function suggestGrade(code: string, grades: string[]): string {
  const find = (label: string) => grades.find((g) => norm(g) === norm(label));
  const n = /^0*(\d{1,2})$/.exec(code);
  if (n && Number(n[1]) >= 1) return find(`${ordinal(Number(n[1]))} grade`) ?? code;
  if (/^(k|kg|kinder|kindergarten)$/i.test(code)) return find("Kindergarten") ?? code;
  return find(code) ?? code;
}

export type GradeMap = Record<string, string>;

// ---- Plan ------------------------------------------------------------------

export type StudentIssue = { student: string; problem: string };
export type FamiliesPlan = {
  rowsRead: number;
  invalidRows: RowIssue[];
  issues: StudentIssue[];          // students not created or not updated (two names in the file, no name)
  families: number;                // FACTS families in the file
  newFamilies: number;
  renamedFamilies: number;
  students: number;                // students in the file
  newStudents: number;
  updatedStudents: number;         // existing children whose name or grade change
  unchangedStudents: number;
  inTwoFamilies: number;
  newFamilyParents: number;
  grades: { code: string; students: number; grade: string }[];
  fingerprint: string;
  // what apply writes
  famCreate: { id: string; name: string }[];
  famRename: { id: string; name: string }[];
  kidCreate: { id: string; name: string; grade: string; family: string }[];
  kidUpdate: { childId: number; id: string; name: string; grade: string }[];
  famParents: { family: string; parent: string }[];
  famStudents: { family: string; student: string }[];
};

/** The one name (or grade) a student has in the file; null if it has two different ones. */
const only = (s: Set<string>) => (s.size === 1 ? [...s][0] : null);

export async function planFamiliesImport(sql: Db, schoolId: number, a: FamiliesAnalysis, mapIn: GradeMap | null): Promise<FamiliesPlan> {
  const famIds = [...a.families.keys()];
  const studentIds = [...a.students.keys()];
  const [school] = await sql<{ grades: string[]; facts_grade_map: GradeMap }[]>`select grades, facts_grade_map from schools where id = ${schoolId}`;
  const grades = school?.grades ?? [];
  const saved = school?.facts_grade_map ?? {};

  const existingFams = new Map(
    (famIds.length ? await sql<{ facts_family_id: string; name: string }[]>`
      select facts_family_id, name from families where school_id = ${schoolId} and facts_family_id = any(${famIds}::text[])` : [])
      .map((r) => [r.facts_family_id, r.name]),
  );
  const existingKids = new Map(
    (studentIds.length ? await sql<{ facts_id: string; id: number; name: string; grade: string }[]>`
      select facts_id, id, name, grade from children where school_id = ${schoolId} and facts_id = any(${studentIds}::text[])` : [])
      .map((r) => [r.facts_id, r]),
  );
  const fpKeys = [...a.familyParents.values()];
  const knownFp = new Set(
    (fpKeys.length ? await sql<{ f: string; p: string }[]>`
      select family_facts_id as f, parent_facts_id as p from facts_family_parents
      where school_id = ${schoolId} and parent_facts_id = any(${[...new Set(fpKeys.map((x) => x.parent))]}::text[])` : []).map((r) => key(r.f, r.p)),
  );

  // Grade codes in the file and how they will read.
  const codeCount = new Map<string, number>();
  for (const s of a.students.values()) { const g = only(s.grades); if (g) codeCount.set(g, (codeCount.get(g) ?? 0) + 1); }
  const gradeOf = (code: string) => {
    const chosen = mapIn?.[code] ?? saved[code];
    return (chosen && chosen.trim().slice(0, MAX_GRADE)) || suggestGrade(code, grades);
  };
  const gradeList = [...codeCount.entries()].sort((x, y) => idOrder(x[0], y[0])).map(([code, n]) => ({ code, students: n, grade: gradeOf(code) }));

  const plan: FamiliesPlan = {
    rowsRead: a.rowsRead, invalidRows: a.invalid, issues: [], families: famIds.length, newFamilies: 0, renamedFamilies: 0,
    students: studentIds.length, newStudents: 0, updatedStudents: 0, unchangedStudents: 0, inTwoFamilies: 0, newFamilyParents: 0,
    grades: gradeList, fingerprint: "", famCreate: [], famRename: [], kidCreate: [], kidUpdate: [], famParents: [], famStudents: [],
  };

  for (const f of [...a.families.values()].sort((x, y) => idOrder(x.id, y.id))) {
    const name = only(f.names) ?? [...f.names].sort()[0] ?? `Family ${f.id}`;
    const before = existingFams.get(f.id);
    if (before === undefined) { plan.newFamilies++; plan.famCreate.push({ id: f.id, name }); }
    else if (before !== name) { plan.renamedFamilies++; plan.famRename.push({ id: f.id, name }); }
  }

  for (const s of [...a.students.values()].sort((x, y) => idOrder(x.id, y.id))) {
    const fams = [...s.families].sort(idOrder);
    if (fams.length > 1) plan.inTwoFamilies++;
    for (const f of fams) plan.famStudents.push({ family: f, student: s.id });
    const name = only(s.names);
    if (!name) {
      plan.issues.push({ student: s.id, problem: s.names.size ? "has two different names in the file: not changed" : "has no name in the file: not changed" });
      continue;
    }
    const code = only(s.grades);
    const kid = existingKids.get(s.id);
    // Two different grades, or none: keep the grade the child already has.
    const grade = code ? gradeOf(code) : kid?.grade ?? "";
    if (s.grades.size > 1) plan.issues.push({ student: s.id, problem: "has two different grades in the file: grade not changed" });
    if (!kid) { plan.newStudents++; plan.kidCreate.push({ id: s.id, name, grade, family: fams[0] }); }
    else if (kid.name !== name || kid.grade !== grade) { plan.updatedStudents++; plan.kidUpdate.push({ childId: kid.id, id: s.id, name, grade }); }
    else plan.unchangedStudents++;
  }

  for (const fp of fpKeys.sort((x, y) => idOrder(x.family, y.family) || idOrder(x.parent, y.parent))) {
    if (!knownFp.has(key(fp.family, fp.parent))) { plan.newFamilyParents++; plan.famParents.push(fp); }
  }

  plan.fingerprint = createHash("sha256").update(JSON.stringify([
    plan.famCreate, plan.famRename, plan.kidCreate, plan.kidUpdate, plan.famParents, plan.famStudents.length,
  ])).digest("hex");
  return plan;
}

/** The numbers kept for an import (no names, no ids). */
export function familiesSummary(p: FamiliesPlan) {
  return {
    rowsRead: p.rowsRead, invalidRows: p.invalidRows.length, issues: p.issues.length, families: p.families, newFamilies: p.newFamilies,
    renamedFamilies: p.renamedFamilies, students: p.students, newStudents: p.newStudents, updatedStudents: p.updatedStudents,
    unchangedStudents: p.unchangedStudents, inTwoFamilies: p.inTwoFamilies, newFamilyParents: p.newFamilyParents,
  };
}

export type FamiliesApply = { error?: string; stale?: boolean; plan?: FamiliesPlan };

/**
 * Applies the file in one transaction, only if it still matches the preview the
 * school saw (fingerprint). The grade map chosen in the preview is saved for next time.
 */
export async function applyFamiliesImport(
  sql: Db, schoolId: number, text: string, map: GradeMap, expectedFingerprint: string, by: string,
): Promise<FamiliesApply> {
  const a = analyzeFamiliesCsv(text);
  if (a.error) return { error: a.error };
  return (await sql.begin(async (txRaw) => {
    const tx = txRaw as unknown as Db;
    await tx`select pg_advisory_xact_lock(hashtext(${`facts:${schoolId}`}))`;
    const plan = await planFamiliesImport(tx, schoolId, a, map);
    if (plan.fingerprint !== expectedFingerprint) return { stale: true, plan };

    const savedMap: GradeMap = {};
    for (const g of plan.grades) savedMap[g.code] = g.grade;
    await tx`update schools set facts_grade_map = facts_grade_map || ${tx.json(savedMap)}::jsonb where id = ${schoolId}`;

    if (plan.famCreate.length) {
      await tx`
        insert into families (school_id, name, status, decided_at, decided_by, facts_family_id)
        select ${schoolId}, n, 'approved', now(), ${`FACTS import (${by})`.slice(0, 200)}, f
        from unnest(${plan.famCreate.map((x) => x.id)}::text[], ${plan.famCreate.map((x) => x.name)}::text[]) as t(f, n)`;
    }
    if (plan.famRename.length) {
      await tx`
        update families x set name = t.n
        from unnest(${plan.famRename.map((x) => x.id)}::text[], ${plan.famRename.map((x) => x.name)}::text[]) as t(f, n)
        where x.school_id = ${schoolId} and x.facts_family_id = t.f`;
    }
    if (plan.kidCreate.length) {
      await tx`
        insert into children (school_id, family_id, name, grade, facts_id, updated_by)
        select ${schoolId}, f.id, t.n, t.g, t.s, ${"FACTS import"}
        from unnest(${plan.kidCreate.map((x) => x.id)}::text[], ${plan.kidCreate.map((x) => x.name)}::text[],
                    ${plan.kidCreate.map((x) => x.grade)}::text[], ${plan.kidCreate.map((x) => x.family)}::text[]) as t(s, n, g, fam)
        join families f on f.school_id = ${schoolId} and f.facts_family_id = t.fam`;
    }
    if (plan.kidUpdate.length) {
      await tx`
        update children c set name = t.n, grade = t.g, updated_at = now(), updated_by = ${"FACTS import"}
        from unnest(${plan.kidUpdate.map((x) => x.childId)}::int[], ${plan.kidUpdate.map((x) => x.name)}::text[], ${plan.kidUpdate.map((x) => x.grade)}::text[]) as t(id, n, g)
        where c.id = t.id and c.school_id = ${schoolId}`;
    }
    if (plan.famParents.length) {
      await tx`
        insert into facts_family_parents (school_id, family_facts_id, parent_facts_id)
        select ${schoolId}, f, p from unnest(${plan.famParents.map((x) => x.family)}::text[], ${plan.famParents.map((x) => x.parent)}::text[]) as t(f, p)
        on conflict do nothing`;
    }
    if (plan.famStudents.length) {
      await tx`
        insert into facts_family_students (school_id, family_facts_id, student_facts_id)
        select ${schoolId}, f, s from unnest(${plan.famStudents.map((x) => x.family)}::text[], ${plan.famStudents.map((x) => x.student)}::text[]) as t(f, s)
        on conflict do nothing`;
    }
    await tx`
      insert into facts_imports (school_id, kind, file_sha256, summary, created_by)
      values (${schoolId}, 'families', ${createHash("sha256").update(text).digest("hex")}, ${tx.json(familiesSummary(plan))}, ${by})`;
    return { plan };
  })) as FamiliesApply;
}
