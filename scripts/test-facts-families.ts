// Checks for creating families and children from the FACTS report, and for
// parents joining their FACTS family through the invitation. Fictitious data
// only, on a THROWAWAY database (never the live one):
//
//   createdb portal_test && psql portal_test -f db/schema.sql
//   TEST_DATABASE_URL=postgres://.../portal_test npx tsx scripts/test-facts-families.ts
//
// The script refuses to run if the database already has schools.
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { analyzeAccessCsv, applyAccessImport, planAccessImport, type Db } from "../lib/facts-access";
import { acceptAsExistingAccount, acceptAsNewAccount, createInvitations } from "../lib/facts-accounts";
import { analyzeFamiliesCsv, applyFamiliesImport, displayName, planFamiliesImport, suggestGrade, type GradeMap } from "../lib/facts-families";
import { visibleChildren, type Adult } from "../lib/student-access";

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error("Set TEST_DATABASE_URL to a throwaway database.");
const sql = postgres(url, { max: 4, onnotice: () => {} }) as unknown as Db;

let passed = 0, failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) { passed++; console.log(`  ok   ${name}`); }
  else { failed++; console.log(`  FAIL ${name}`, detail ?? ""); }
}
const section = (t: string) => console.log(`\n${t}`);

const H = `"Student ID (System)","LastName, FirstName","Grade Level","Family ID","Family Name","Family Order","Has access to Parents Web","Parent Individual ID"`;
const row = (s: string, name: string, grade: string, f: string, fname: string, access: string, p: string) =>
  `"${s}","${name}","${grade}","${f}","${fname}","1","${access}","${p}"`;
const file = (...rows: string[]) => "﻿" + [H, ...rows].join("\r\n") + "\r\n";

async function school(slug: string) {
  const [s] = await sql<{ id: number }[]>`insert into schools (slug, name, school_year) values (${slug}, ${`Test ${slug}`}, '2026–27') returning id`;
  await sql`insert into school_years (school_id, label, starts_on, ends_on, status) values (${s.id}, '2026–27', '2026-07-01', '2027-06-30', 'active')`;
  return s.id;
}
async function user(email: string) {
  const id = randomUUID();
  await sql`insert into auth_user (id, name, email) values (${id}, ${email}, ${email})`;
  return id;
}
async function importFamilies(schoolId: number, text: string, map: GradeMap = {}) {
  const plan = await planFamiliesImport(sql, schoolId, analyzeFamiliesCsv(text), map);
  const r = await applyFamiliesImport(sql, schoolId, text, map, plan.fingerprint, "test");
  if (r.error || r.stale) throw new Error(`apply failed: ${r.error ?? "stale"}`);
  return r.plan!;
}
async function importAccess(schoolId: number, text: string) {
  const plan = await planAccessImport(sql, schoolId, analyzeAccessCsv(text));
  const r = await applyAccessImport(sql, schoolId, text, plan.fingerprint, "test");
  if (r.error || r.stale) throw new Error(`apply failed: ${r.error ?? "stale"}`);
}
const fam = async (schoolId: number, factsId: string) =>
  (await sql<{ id: number; name: string; status: string; user_id: string | null }[]>`
    select id, name, status, user_id from families where school_id = ${schoolId} and facts_family_id = ${factsId}`)[0];
const kid = async (schoolId: number, factsId: string) =>
  (await sql<{ id: number; name: string; grade: string; family_id: number }[]>`
    select id, name, grade, family_id from children where school_id = ${schoolId} and facts_id = ${factsId}`)[0];
const names = async (a: Adult) => (await visibleChildren(sql, a)).map((c) => c.name).sort();

const REPORT = file(
  row("100", "García López, Ana", "01", "10", "García", "Yes", "500"),
  row("100", "García López, Ana", "01", "10", "García", "Yes", "501"),
  row("101", "García López, Bruno", "K", "10", "García", "Yes", "500"),
  row("101", "García López, Bruno", "", "10", "García", "No", "501"),   // grade empty in one row
  row("102", "Smith, Carla", "P3", "11", "Smith", "Yes", "510"),
  row("102", "Smith, Carla", "P3", "9", "Jones", "Yes", "520"),          // in two families
  row("103", "Two, Names", "02", "12", "Two", "Yes", "530"),
  row("103", "Other, Name", "02", "12", "Two", "Yes", "530"),            // two names: not created
  row("", "Empty, Id", "03", "12", "Two", "Yes", "530"),                 // invalid row
);

async function main() {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from schools`;
  if (n) throw new Error("This database already has schools. Use an empty throwaway database.");
  const A = await school("test-a");
  const B = await school("test-b");

  section("1. Reading the file");
  check("“Last, First” reads as “First Last”", displayName(" García López,  Ana ") === "Ana García López");
  check("a name without a comma stays as written", displayName("Madonna") === "Madonna");
  const grades = ["Preschool", "Pre-K", "Kindergarten", "1st grade", "2nd grade", "8th grade"];
  check("grade 01 suggests 1st grade, 08 suggests 8th grade, K suggests Kindergarten",
    suggestGrade("01", grades) === "1st grade" && suggestGrade("08", grades) === "8th grade" && suggestGrade("K", grades) === "Kindergarten");
  check("an unknown code (P3) stays as in FACTS", suggestGrade("P3", grades) === "P3");
  const a = analyzeFamiliesCsv(REPORT);
  check("9 rows, 1 invalid, 4 students, 4 families", a.rowsRead === 9 && a.invalid.length === 1 && a.students.size === 4 && a.families.size === 4, { rows: a.rowsRead, inv: a.invalid, s: a.students.size, f: a.families.size });
  check("missing columns are refused", !!analyzeFamiliesCsv(`"Student ID (System)","Family ID"\n"1","2"`).error);

  section("2. Preview and apply");
  const plan = await planFamiliesImport(sql, A, a, null);
  check("preview: 4 new families, 3 new children, 1 student not changed (two names), 1 in two families",
    plan.newFamilies === 4 && plan.newStudents === 3 && plan.issues.length === 1 && plan.inTwoFamilies === 1, { ...plan, famCreate: undefined });
  check("preview saves nothing", (await sql`select 1 from families where school_id = ${A}`).length === 0);
  const stale = await applyFamiliesImport(sql, A, REPORT, {}, "not-the-preview", "test");
  check("apply with an old preview is refused and writes nothing", !!stale.stale && (await sql`select 1 from families where school_id = ${A}`).length === 0);
  await importFamilies(A, REPORT, { P3: "Preschool" });
  const g = await fam(A, "10");
  check("FACTS family created: name, approved, no account", g?.name === "García" && g.status === "approved" && g.user_id === null, g);
  const ana = await kid(A, "100"), bruno = await kid(A, "101"), carla = await kid(A, "102");
  check("children created in their family with name and grade", ana?.name === "Ana García López" && ana.grade === "1st grade" && ana.family_id === g.id && bruno?.grade === "Kindergarten", { ana, bruno });
  check("the grade chosen in the preview is used (P3 → Preschool) and remembered",
    carla?.grade === "Preschool" && (await sql<{ m: GradeMap }[]>`select facts_grade_map as m from schools where id = ${A}`)[0].m.P3 === "Preschool");
  check("a student in two families goes to the first one (Family ID 9)", carla.family_id === (await fam(A, "9")).id);
  check("and is listed under both FACTS families", (await sql`select 1 from facts_family_students where school_id = ${A} and student_facts_id = '102'`).length === 2);
  check("a student with two names is not created", !(await kid(A, "103")));
  check("parents are tied to their families (ids only)", (await sql`select 1 from facts_family_parents where school_id = ${A} and family_facts_id = '10'`).length === 2);
  check("no names are written to the import record", !JSON.stringify((await sql<{ summary: unknown }[]>`select summary from facts_imports where school_id = ${A} and kind = 'families'`)[0].summary).includes("Ana"));

  section("3. Importing again");
  const again = await planFamiliesImport(sql, A, analyzeFamiliesCsv(REPORT), null);
  check("same file again: nothing to change (saved grade choice reused)", again.newFamilies === 0 && again.newStudents === 0 && again.updatedStudents === 0 && again.renamedFamilies === 0 && again.newFamilyParents === 0, { ...again, famCreate: undefined });
  const changed = file(
    row("100", "García López, Ana", "02", "10", "García López", "Yes", "500"),
  );
  const cp = await importFamilies(A, changed);
  check("a new grade and a new family name are applied", cp.updatedStudents === 1 && cp.renamedFamilies === 1 && (await kid(A, "100")).grade === "2nd grade" && (await fam(A, "10")).name === "García López");
  check("students missing from the new file are kept", !!(await kid(A, "101")) && !!(await kid(A, "102")));

  section("4. Who sees the children: still only FACTS access");
  await importAccess(A, REPORT);
  // Parent 500 accepts as a new account; parent 501 as well: both join FACTS family 10.
  const join = async (parentId: string, email: string) => {
    const { created } = await createInvitations(sql, A, [{ parentId, email }], { skipIfInvited: false, source: "panel", by: "test" });
    let uid = "";
    const r = await acceptAsNewAccount(sql, A, created[0].token, "ignored", async (e) => (uid = await user(e)), async (id) => { await sql`delete from auth_user where id = ${id}`; });
    if (!r.ok) throw new Error(r.error);
    return uid;
  };
  const u500 = await join("500", "p500@example.test");
  const u501 = await join("501", "p501@example.test");
  const fu = await sql<{ user_id: string }[]>`select user_id from family_users where family_id = ${g.id} order by created_at`;
  check("both parents joined the FACTS family (two accounts, one family)", fu.length === 2 && fu[0].user_id === u500 && fu[1].user_id === u501, fu);
  check("no extra family was created for them", (await sql`select 1 from families where school_id = ${A}`).length === 4);
  const p500: Adult = { familyId: g.id, userId: u500, schoolId: A }, p501: Adult = { familyId: g.id, userId: u501, schoolId: A };
  check("parent 500 (Yes for Ana and Bruno) sees both", (await names(p500)).join() === "Ana García López,Bruno García López", await names(p500));
  check("parent 501 (No for Bruno) sees only Ana, although Bruno is in the same family", (await names(p501)).join() === "Ana García López", await names(p501));
  const u520 = await join("520", "p520@example.test");
  const f9 = await fam(A, "9");
  check("a parent of the second family joins that family and sees the shared student",
    (await sql`select 1 from family_users where family_id = ${f9.id} and user_id = ${u520}`).length === 1
    && (await names({ familyId: f9.id, userId: u520, schoolId: A })).join() === "Carla Smith");

  section("5. Existing account and deleted account");
  const uOwn = await user("own@example.test");
  const [own] = await sql<{ id: number }[]>`insert into families (school_id, user_id, name, status) values (${A}, ${uOwn}, 'Own family', 'approved') returning id`;
  await sql`insert into family_users (family_id, user_id, school_id) values (${own.id}, ${uOwn}, ${A})`;
  const { created } = await createInvitations(sql, A, [{ parentId: "510", email: "own@example.test" }], { skipIfInvited: false, source: "panel", by: "test" });
  const ex = await acceptAsExistingAccount(sql, A, created[0].token, async () => true);
  check("an account that already has a family keeps it (not moved)", ex.ok && (await sql`select 1 from family_users where user_id = ${uOwn}`).length === 1
    && (await sql`select 1 from family_users where user_id = ${uOwn} and family_id = ${own.id}`).length === 1);
  await sql`delete from auth_user where id = ${u501}`;
  check("deleting a parent's account keeps the FACTS family and its children",
    !!(await fam(A, "10")) && !!(await kid(A, "101")) && (await sql`select 1 from family_users where family_id = ${g.id}`).length === 1);

  section("6. Schools are separate");
  await importFamilies(B, file(row("100", "Other, Kid", "01", "10", "Other", "Yes", "500")));
  check("school B gets its own family and child with the same FACTS ids", (await fam(B, "10"))?.name === "Other" && (await kid(B, "100"))?.name === "Kid Other");
  check("school A is not touched", (await fam(A, "10")).name === "García López" && (await kid(A, "100")).name === "Ana García López");
  check("school A's grade choices are not used in school B", (await sql<{ m: GradeMap }[]>`select facts_grade_map as m from schools where id = ${B}`)[0].m.P3 === undefined);

  section("7. A file the size of the FACTS report (fictitious)");
  const C = await school("test-c");
  const big: string[] = [];
  for (let i = 0; i < 2102; i++) big.push(row(`${10000 + (i % 499)}`, `Last${i % 499}, First`, `0${((i % 499) % 8) + 1}`, `${(i % 499) % 480}`, `Fam ${(i % 499) % 480}`, "Yes", `${20000 + (i % 1034)}`));
  const t0 = Date.now();
  const bp = await importFamilies(C, file(...big));
  check("499 students and 480 families created", bp.newStudents === 499 && bp.newFamilies === 480, { s: bp.newStudents, f: bp.newFamilies, issues: bp.issues.slice(0, 3) });
  check(`preview + apply in ${Date.now() - t0} ms (under 15 s)`, Date.now() - t0 < 15000);

  console.log(`\n${passed} passed, ${failed} failed`);
  await (sql as unknown as { end: () => Promise<void> }).end();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => { console.error(e); process.exit(1); });
