// Checks for the FACTS access import, the invitations and the server-side rule
// that decides which children an adult sees. Fictitious data only, on a
// THROWAWAY database (never the live one):
//
//   createdb portal_test && psql portal_test -f db/schema.sql
//   TEST_DATABASE_URL=postgres://.../portal_test npx tsx scripts/test-facts-access.ts
//
// The script refuses to run if the database already has schools.
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { analyzeAccessCsv, applyAccessImport, planAccessImport, type Db } from "../lib/facts-access";
import {
  acceptAsExistingAccount, acceptAsNewAccount, analyzeEmailsCsv, checkInvitations, createInvitations, listParents, peekInvitation,
} from "../lib/facts-accounts";
import { childForAdult, visibleChildren, type Adult } from "../lib/student-access";

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
const row = (s: string, f: string, access: string, p: string, name = "Doe, Test") => `"${s}","${name}","3","${f}","Fam ${f}","1","${access}","${p}"`;
const file = (...rows: string[]) => "﻿" + [H, ...rows].join("\r\n") + "\r\n";

async function apply(schoolId: number, text: string) {
  const plan = await planAccessImport(sql, schoolId, analyzeAccessCsv(text));
  const r = await applyAccessImport(sql, schoolId, text, plan.fingerprint, "test");
  if (r.error || r.stale) throw new Error(`apply failed: ${r.error ?? "stale"}`);
  return r.plan!;
}

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
async function family(schoolId: number, userId: string, name: string) {
  const [f] = await sql<{ id: number }[]>`insert into families (school_id, user_id, name, status) values (${schoolId}, ${userId}, ${name}, 'approved') returning id`;
  await sql`insert into family_users (family_id, user_id, school_id) values (${f.id}, ${userId}, ${schoolId})`;
  return f.id;
}
async function child(schoolId: number, familyId: number, name: string, factsId: string | null) {
  const [c] = await sql<{ id: number }[]>`insert into children (school_id, family_id, name, grade, facts_id) values (${schoolId}, ${familyId}, ${name}, '3rd grade', ${factsId}) returning id`;
  return c.id;
}
/** Verifies an association the only way the app does: through an invitation link. */
async function verifyByInvite(schoolId: number, parentId: string, email: string, userId: string) {
  const { created } = await createInvitations(sql, schoolId, [{ parentId, email }], { skipIfInvited: false, source: "panel", by: "test" });
  const r = await acceptAsExistingAccount(sql, schoolId, created[0].token, async (id) => id === userId);
  if (!r.ok) throw new Error(`verify failed: ${r.error}`);
}
const ids = async (a: Adult) => (await visibleChildren(sql, a)).map((c) => c.name).sort();
const linkState = async (schoolId: number, p: string, s: string) =>
  (await sql<{ state: string }[]>`select state from facts_student_access where school_id = ${schoolId} and parent_facts_id = ${p} and student_facts_id = ${s}`)[0]?.state ?? null;

async function main() {
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from schools`;
  if (n) throw new Error("This database already has schools. Use an empty throwaway database.");

  const A = await school("test-a");
  const B = await school("test-b");

  // Adults of school A (each with their own family account).
  const u1 = await user("p1@example.test"), u2 = await user("p2@example.test"), u4 = await user("p4@example.test"), uX = await user("nolink@example.test");
  const f1 = await family(A, u1, "Family One"), f2 = await family(A, u2, "Family Two"), f4 = await family(A, u4, "Family Four"), fX = await family(A, uX, "Family X");
  const a1: Adult = { familyId: f1, userId: u1, schoolId: A }, a2: Adult = { familyId: f2, userId: u2, schoolId: A };
  const a4: Adult = { familyId: f4, userId: u4, schoolId: A }, aX: Adult = { familyId: fX, userId: uX, schoolId: A };
  // Children of A: Ann is FACTS S100 (listed under Family Two), Ben is FACTS S200, Manual has no FACTS id.
  const cAnn = await child(A, f2, "Ann", "S100");
  const cBen = await child(A, f4, "Ben", "S200");
  await child(A, f1, "Manual", null);
  await child(A, fX, "Xavi", "S300");

  section("1. Reading the FACTS file");
  const f1text = file(
    row("S100", "F1", "Yes", "P1", `O""Brien, Ann`),
    row("S100", "F2", "No", "P2"),           // same student in a second family; P2 has no access
    row("S100", "F1", "Yes", "P1"),          // repeated with the same value
    row("S200", "F4", "Yes", "P4"),
    row("S300", "F9", "Yes", "P3"),          // P3 has no verified account yet
    row("S300", "F9", "Maybe", "P5"),        // invalid value: never Yes
    row("S300", "", "Yes", "P6"),            // empty Family ID: invalid
    row("S300", "F9", "", "P7"),             // empty value: invalid
    `"S400","Doe, Multi\nLine","3","F9","Fam","1","yes","P8"`, // line break inside quotes, lower-case yes
  );
  const an = analyzeAccessCsv(f1text);
  check("rows read = 9", an.rowsRead === 9, an.rowsRead);
  check("unique links = 7 (rows with an empty id are not links)", an.links.size === 7, an.links.size);
  check("1 repeated row", an.duplicateRows === 1, an.duplicateRows);
  check("3 invalid rows (Maybe, empty Family ID, empty value)", an.invalid.length === 3, an.invalid);
  check("“Maybe” is never Yes: link blocked", an.links.get("P5\u0000S300")?.blocked === true);
  check("name with comma and quotes does not move columns", an.links.has("P1\u0000S100"));
  check("student in two FACTS families kept separately", an.familyStudents.has("F1\u0000S100") && an.familyStudents.has("F2\u0000S100"));
  check("missing column is an error", !!analyzeAccessCsv(`"Student ID (System)","Parent Individual ID","Family ID"\n"1","2","3"`).error);
  check("unclosed quote is an error", !!analyzeAccessCsv(H + '\n"S1,x').error);
  check("ids are text: leading zeros kept", analyzeAccessCsv(file(row("00123", "F1", "Yes", "007"))).links.has("007\u000000123"));

  section("2. Preview and apply (atomic, idempotent)");
  const p1 = await planAccessImport(sql, A, an);
  check("preview: 4 accesses to turn on (P1, P4, P3, P8)", p1.activate === 4, p1);
  check("preview: all pending association (no verified account yet)", p1.activatePending === 4 && p1.activateNow === 0, p1);
  check("preview: P2 No stored without access", p1.newWithoutAccess === 1, p1.newWithoutAccess);
  check("preview: 2 invalid links left as they are (Maybe, empty value)", p1.invalidLinks === 2, p1.invalidLinks);
  check("preview: students with access but no child in the portal (S400)", p1.studentsWithoutChild === 1, p1.studentsWithoutChild);
  check("preview writes nothing", (await sql`select 1 from facts_student_access`).length === 0);
  const stale = await applyAccessImport(sql, A, f1text, "wrong-fingerprint", "test");
  check("apply with an old preview is refused and writes nothing", !!stale.stale && (await sql`select 1 from facts_student_access`).length === 0);
  await apply(A, f1text);
  check("P1–S100 granted", (await linkState(A, "P1", "S100")) === "granted");
  check("P2–S100 denied", (await linkState(A, "P2", "S100")) === "denied");
  check("P5–S300 (Maybe) not stored", (await linkState(A, "P5", "S300")) === null);
  const again = await planAccessImport(sql, A, analyzeAccessCsv(f1text));
  check("re-importing the same file changes nothing", again.changes.length === 0 && again.unchanged === 5, again);
  check("no name, grade or Family Order stored", (await sql`
    select 1 from facts_imports where summary::text ~* '(Brien|Doe|Fam F)'`).length === 0);

  section("3. Accounts without a verified association see nothing from FACTS");
  check("adult 1 (P1 Yes, not verified) does not see Ann", !(await ids(a1)).includes("Ann"), await ids(a1));
  check("adult 1 still sees the child without FACTS id in their family", (await ids(a1)).includes("Manual"));
  check("Family Two (where Ann is listed) does not see Ann without FACTS access", !(await ids(a2)).includes("Ann"), await ids(a2));

  section("4. Two adults, different permissions, same student (student in two families)");
  await verifyByInvite(A, "P1", "p1@example.test", u1);
  await verifyByInvite(A, "P2", "p2@example.test", u2);
  check("adult 1 (P1 Yes) sees Ann although Ann is listed in another family", (await ids(a1)).includes("Ann"), await ids(a1));
  check("adult 2 (P2 No) does not see Ann", !(await ids(a2)).includes("Ann"), await ids(a2));
  check("direct id: adult 2 cannot act for Ann", (await childForAdult(sql, a2, cAnn)) === null);
  check("direct id: adult 1 can act for Ann", (await childForAdult(sql, a1, cAnn))?.name === "Ann");
  check("direct id: nonsense id refused", (await childForAdult(sql, a1, -1)) === null);

  section("5. Revocation Yes → No, and partial files");
  const p2 = await apply(A, file(row("S100", "F1", "No", "P1")));
  check("preview counted 1 revocation", p2.revoke === 1, p2);
  check("adult 1 lost Ann", !(await ids(a1)).includes("Ann"));
  check("direct id: adult 1 can no longer act for Ann", (await childForAdult(sql, a1, cAnn)) === null);
  check("links not in the partial file are unchanged (P4–S200 still granted)", (await linkState(A, "P4", "S200")) === "granted");

  section("6. Yes/No conflict");
  await verifyByInvite(A, "P4", "p4@example.test", u4);
  check("adult 4 sees Ben before the conflict", (await ids(a4)).includes("Ben"));
  const p3 = await apply(A, file(row("S200", "F4", "Yes", "P4"), row("S200", "F4", "No", "P4")));
  check("conflict reported and existing access suspended", p3.conflicts.length === 1 && p3.conflicts[0].suspends && p3.suspend === 1, p3.conflicts);
  check("adult 4 does not see Ben during the conflict", !(await ids(a4)).includes("Ben"));
  check("direct id refused during the conflict", (await childForAdult(sql, a4, cBen)) === null);
  await apply(A, file(row("S200", "F4", "Yes", "P4")));
  check("a later consistent Yes ends the conflict", (await ids(a4)).includes("Ben"));

  section("7. Verification from the manual field (new account) activates pending links");
  check("Xavi (S300, P3 Yes) not visible to anyone yet", !(await ids(aX)).includes("Xavi"));
  const inv = await createInvitations(sql, A, [{ parentId: "P3", email: "new.parent@example.test" }], { skipIfInvited: false, source: "panel", by: "test" });
  check("invitation created for a new account", inv.created.length === 1 && inv.created[0].mode === "new_account", inv.checks);
  const resent = await createInvitations(sql, A, [{ parentId: "P3", email: "new.parent@example.test" }], { skipIfInvited: false, source: "panel", by: "test" });
  check("resend makes a new link", resent.created.length === 1);
  check("the old link stops working after a resend", (await peekInvitation(sql, A, inv.created[0].token)) === null);
  let newUser = "";
  const acc = await acceptAsNewAccount(sql, A, resent.created[0].token, "The New Family",
    async (email) => (newUser = await user(email)), async (id) => { await sql`delete from auth_user where id = ${id}`; });
  check("new account created through the link", acc.ok, acc);
  const [nf] = await sql<{ id: number; status: string }[]>`select id, status from families where user_id = ${newUser}`;
  check("its family account is approved (the school invited it)", nf?.status === "approved");
  const aNew: Adult = { familyId: nf.id, userId: newUser, schoolId: A };
  check("pending FACTS access is active at once: sees Xavi", (await ids(aNew)).includes("Xavi"), await ids(aNew));
  check("the link works only once", !(await acceptAsNewAccount(sql, A, resent.created[0].token, "Again", async (e) => user(e), async () => {})).ok);
  await sql`delete from auth_user where id = ${newUser}`;
  check("deleting the account removes the association; the parent can be invited again",
    (await listParents(sql, A)).find((p) => p.parentId === "P3")?.status !== "active"
    && (await checkInvitations(sql, A, [{ parentId: "P3", email: "new.parent@example.test" }], { skipIfInvited: false }))[0].kind === "invite");

  section("8. Verification from the emails file (existing account, password)");
  const emailsCsv = "﻿" + [
    `"Parent Individual ID","Email"`,
    `"P8","existing@example.test"`,
    `"P8","existing@example.test"`,          // repeated row
    `"P9","not-an-email"`,                   // badly written
    `"P10","a@example.test"`, `"P10","b@example.test"`, // one id, two emails
    `"P11","shared@example.test"`, `"P12","shared@example.test"`, // one email, two ids
    `"P1","p1@example.test"`,                // already active
  ].join("\n");
  const ea = analyzeEmailsCsv(emailsCsv);
  check("emails file: 1 repeated row", ea.duplicateRows === 1, ea);
  check("emails file: badly written email reported", ea.invalid.length === 1, ea.invalid);
  check("emails file: same id with two emails reported", ea.idWithTwoEmails.length === 1 && ea.idWithTwoEmails[0].parentId === "P10");
  check("emails file: same email with two ids reported", ea.emailWithTwoIds.length === 1);
  const checks = await checkInvitations(sql, A, ea.pairs, { skipIfInvited: true });
  check("emails file: only P8 to invite, P1 skipped as active",
    checks.filter((c) => c.kind === "invite").map((c) => c.parentId).join() === "P8" && checks.find((c) => c.parentId === "P1")?.kind === "skip", checks);
  const uE = await user("existing@example.test");
  const fE = await family(A, uE, "Existing Family");
  const created = await createInvitations(sql, A, ea.pairs, { skipIfInvited: true, source: "csv", by: "test" });
  check("existing account gets a confirmation link, not an automatic link", created.created[0]?.mode === "existing_account"
    && (await sql`select 1 from facts_parents where school_id = ${A} and parent_facts_id = 'P8' and verified_at is not null`).length === 0);
  const wrong = await acceptAsExistingAccount(sql, A, created.created[0].token, async () => false);
  check("wrong password: not verified", !wrong.ok);
  const right = await acceptAsExistingAccount(sql, A, created.created[0].token, async (id) => id === uE);
  check("right password: verified", right.ok, right);
  await child(A, fE, "Sara", "S400");
  check("pending access of P8 (S400) is active", (await ids({ familyId: fE, userId: uE, schoolId: A })).includes("Sara"));
  const re = await createInvitations(sql, A, analyzeEmailsCsv(emailsCsv).pairs, { skipIfInvited: true, source: "csv", by: "test" });
  check("re-importing the emails file sends nothing to active parents", re.created.length === 0, re.checks);
  const reInvited = await createInvitations(sql, A, [{ parentId: "P13", email: "later@example.test" }], { skipIfInvited: true, source: "csv", by: "test" });
  const reAgain = await createInvitations(sql, A, [{ parentId: "P13", email: "later@example.test" }], { skipIfInvited: true, source: "csv", by: "test" });
  check("re-importing does not resend to someone already invited with the same email", reInvited.created.length === 1 && reAgain.created.length === 0);
  const taken = await checkInvitations(sql, A, [{ parentId: "P14", email: "p1@example.test" }], { skipIfInvited: true });
  check("an email already linked to another Parent ID is refused", taken[0].kind === "error", taken);

  section("9. Expired and used links");
  const exp = await createInvitations(sql, A, [{ parentId: "P15", email: "late@example.test" }], { skipIfInvited: false, source: "panel", by: "test" });
  await sql`update facts_invitations set expires_at = now() - interval '1 minute' where school_id = ${A} and parent_facts_id = 'P15'`;
  check("expired link cannot be opened", (await peekInvitation(sql, A, exp.created[0].token)) === null);
  check("expired link cannot be used", !(await acceptAsNewAccount(sql, A, exp.created[0].token, "Late", async (e) => user(e), async () => {})).ok);
  check("panel shows it as expired", (await listParents(sql, A)).find((p) => p.parentId === "P15")?.status === "expired");
  check("used link cannot be used again", !(await acceptAsExistingAccount(sql, A, created.created[0].token, async () => true)).ok);
  check("invitation expiry is 7 days", (await sql<{ d: number }[]>`
    select round(extract(epoch from expires_at - created_at) / 86400)::int as d from facts_invitations where school_id = ${A} and parent_facts_id = 'P13'`)[0].d === 7);
  await apply(A, file(row("S300", "F9", "Yes", "P20")));
  const statuses = Object.fromEntries((await listParents(sql, A)).map((p) => [p.parentId, p.status]));
  check("panel statuses: active / invited / needs email", statuses.P1 === "active" && statuses.P13 === "invited" && statuses.P20 === "pending_email" && statuses.P5 === undefined, statuses);

  section("10. Isolation between schools");
  const uB = await user("b-parent@example.test");
  const fB = await family(B, uB, "B Family");
  await child(B, fB, "B-Ann", "S100"); // same FACTS ids in another school
  await apply(B, file(row("S100", "F1", "No", "P1")));
  check("school B's file does not touch school A's link", (await linkState(A, "P1", "S100")) === "denied" && (await linkState(A, "P4", "S200")) === "granted");
  await apply(B, file(row("S100", "F1", "Yes", "P1")));
  check("adult 1 of school A (P1 there) does not see school B's child with the same FACTS ids", !(await ids(a1)).includes("B-Ann"));
  check("direct id across schools refused", (await childForAdult(sql, { ...a1, schoolId: B }, (await sql<{ id: number }[]>`select id from children where name = 'B-Ann'`)[0].id)) === null);
  const bInv = await createInvitations(sql, A, [{ parentId: "P16", email: "x@example.test" }], { skipIfInvited: false, source: "panel", by: "test" });
  check("a link of school A does not work at school B", (await peekInvitation(sql, B, bInv.created[0].token)) === null);
  const other = await checkInvitations(sql, A, [{ parentId: "P17", email: "b-parent@example.test" }], { skipIfInvited: false });
  check("an account of another school cannot be linked", other[0].kind === "error", other);
  check("staff of school B see only B's parents", (await listParents(sql, B)).every((p) => p.parentId === "P1") && (await listParents(sql, B)).length === 1);

  section("11. A file the size of the reviewed FACTS report (fictitious ids)");
  const C = await school("test-c");
  const big: string[] = [];
  for (let i = 0; i < 1945; i++) big.push(row(`ST${i % 900}`, `FA${i % 700}`, i < 994 ? "Yes" : "No", `PA${i}`));
  for (let i = 0; i < 157; i++) big.push(big[i]); // repeated rows, same value
  const t0 = Date.now();
  const bp = await apply(C, file(...big));
  check("2,102 rows, 1,945 unique links, 994 Yes and 951 No", bp.rowsRead === 2102 && bp.uniqueLinks === 1945 && bp.activate === 994 && bp.newWithoutAccess === 951 && bp.duplicateRows === 157, bp && { ...bp, changes: bp.changes.length, pendingParents: bp.pendingParents.length });
  check(`preview + apply in ${Date.now() - t0} ms (under 15 s)`, Date.now() - t0 < 15000);
  const bp2 = await planAccessImport(sql, C, analyzeAccessCsv(file(...big)));
  check("same big file again: nothing to change", bp2.changes.length === 0 && bp2.unchanged === 1945);

  console.log(`\n${passed} passed, ${failed} failed`);
  await (sql as unknown as { end: () => Promise<void> }).end();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => { console.error(e); process.exit(1); });
