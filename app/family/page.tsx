// Family sign-in, and "My family" for a family the school approved (step 6a).
// The public portal does not need any of this.
import Link from "next/link";
import { db } from "../../lib/db";
import { familyOfUser, type Family } from "../../lib/family";
import { formatRange, todayIn, when, type SubmissionRow } from "../../lib/my-family";
import { currentStaff } from "../../lib/staff";
import { AdminTop } from "../admin/chrome";
import { FamilySignInForm } from "./forms";
import { MyFamily, type ChildRow, type Details, type Sent } from "./my-family";

export const dynamic = "force-dynamic";
export const metadata = { title: "My family" };

async function load(f: Family) {
  // Every query is limited to this family's own rows.
  const [[details], children, sent, [school]] = await Promise.all([
    db()<Details[]>`
      select parent_names as "parentNames", phone, contact2_name as "contact2Name", contact2_phone as "contact2Phone", contact2_relation as "contact2Relation"
      from families where id = ${f.id}`,
    db()<ChildRow[]>`
      select id, name, grade, teacher
      from children where family_id = ${f.id} order by id`,
    db()<SubmissionRow[]>`
      select id, kind, category, child_name as "childName", date_from::text as "dateFrom", date_to::text as "dateTo",
        message, status, created_at::text as "createdAt", status_at::text as "statusAt"
      from family_submissions where family_id = ${f.id}
      order by created_at desc, id desc limit 200`,
    db()<{ timezone: string }[]>`select timezone from schools where id = ${f.schoolId}`,
  ]);
  const tz = school?.timezone || "UTC";
  const rows: Sent[] = sent.map((s) => ({
    ...s,
    dates: formatRange(s.dateFrom, s.dateTo),
    sentAt: when(s.createdAt, tz),
    changedAt: s.statusAt ? when(s.statusAt, tz) : "",
  }));
  return { details, children: [...children], sent: rows, today: todayIn(tz), tomorrow: todayIn(tz, 1) };
}

export default async function FamilyPage() {
  const { user, staff } = await currentStaff();
  const family = user ? await familyOfUser(user.id) : null;

  if (user && family?.status === "approved") {
    const data = await load(family);
    return (
      <>
        <AdminTop signedIn area="family" />
        <main className="adm-main">
          <MyFamily name={family.name} email={family.email} {...data} />
        </main>
      </>
    );
  }

  return (
    <>
      <AdminTop signedIn={false} area="family" />
      <main className="adm-main">
        <div className="adm-card adm-card--narrow">
          <h1>Family sign-in</h1>
          {user && staff && <p className="adm-msg adm-msg--ok">You are signed in as school staff. <Link href="/admin">Go to the staff area</Link>.</p>}
          <p className="lead">For families of the school. The Parent Portal itself is open to everyone without signing in.</p>
          <FamilySignInForm />
        </div>
      </main>
    </>
  );
}
