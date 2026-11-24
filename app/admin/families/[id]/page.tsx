// One family, as the school sees it: contact details, and its children (kept by the school).
import { notFound, redirect } from "next/navigation";
import { db } from "../../../../lib/db";
import { currentStaff } from "../../../../lib/staff";
import { AdminTop } from "../../chrome";
import { ChildrenFixer, type KidRow } from "./fixer";
import { Head, SLink } from "../../ui";
import { schoolPath } from "../../../../lib/portal";
import { requirePanelModule } from "../../../../lib/years";

export const dynamic = "force-dynamic";
export const metadata = { title: "Family" };

type Fam = { id: number; name: string; email: string; factsFamilyId: string; status: string; parentNames: string; phone: string; c2Name: string; c2Phone: string; c2Rel: string };

export default async function FamilyDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelModule("families");
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [[f], kids, [counts]] = await Promise.all([
    db()<Fam[]>`
      select f.id, f.name, f.status, f.parent_names as "parentNames", f.phone,
        f.contact2_name as "c2Name", f.contact2_phone as "c2Phone", f.contact2_relation as "c2Rel",
        coalesce((select string_agg(u.email, ', ' order by fu.created_at) from family_users fu join auth_user u on u.id = fu.user_id where fu.family_id = f.id), '') as email,
        coalesce(f.facts_family_id, '') as "factsFamilyId"
      from families f
      where f.id = ${id} and f.school_id = ${staff.schoolId}`,
    // Its own children, and the FACTS students of its FACTS family placed in another family.
    db()<KidRow[]>`
      select c.id, c.name, c.grade, c.teacher, coalesce(c.facts_id, '') as "factsId", c.family_id <> ${id} as "elsewhere"
      from children c
      where c.school_id = ${staff.schoolId} and not c.left_school and (c.family_id = ${id} or c.facts_id in (
        select s.student_facts_id from facts_family_students s join families f on f.school_id = s.school_id and f.facts_family_id = s.family_facts_id
        where f.id = ${id} and s.school_id = ${staff.schoolId}))
      order by c.name, c.id`,
    db()<{ open: number }[]>`select count(*)::int as open from family_submissions where family_id = ${id} and school_id = ${staff.schoolId} and status <> 'resolved'`,
  ]);
  if (!f) notFound();
  const dash = (v: string) => v || <span className="note">Not given yet</span>;
  return (
    <>
      <AdminTop signedIn section="families" />
      <main id="main" className="adm-main">
        <Head back={<SLink href="/admin/families">← All families</SLink>} title={f.name} lead={<>{f.email || "No account yet"}{f.factsFamilyId && ` · FACTS Family ID ${f.factsFamilyId}`}{f.status === "disabled" && " · turned off"}</>} />
        <div className="adm-card">
          <h2 className="sp-card-h">Contact details</h2>
          <dl className="my-dl">
            <dt>Parents</dt><dd>{dash(f.parentNames)}</dd>
            <dt>Phone</dt><dd>{f.phone ? <a href={`tel:${f.phone.replace(/[^\d+]/g, "")}`}>{f.phone}</a> : dash("")}</dd>
            <dt>Second adult</dt>
            <dd>{f.c2Name ? <>{f.c2Name}{f.c2Rel && ` (${f.c2Rel})`}{f.c2Phone && <> · <a href={`tel:${f.c2Phone.replace(/[^\d+]/g, "")}`}>{f.c2Phone}</a></>}</> : dash("")}</dd>
          </dl>
          <p className="note">The family keeps these details up to date from “My family”.{counts.open ? <> They have {counts.open} absence{counts.open === 1 ? "" : "s"} or request{counts.open === 1 ? "" : "s"} not resolved: see <SLink href="/admin/requests?status=open">Absences &amp; requests</SLink>.</> : null}</p>
        </div>
        <div className="adm-card">
          <h2 className="adm-h2">Children</h2>
          <p className="lead">The school keeps this list; the family sees it on “My family” and chooses from it when reporting an absence. A child with a FACTS Student ID is shown only to the adults FACTS gives access to (see <SLink href="/admin/families/facts">FACTS access</SLink>), also in this family.</p>
          <ChildrenFixer familyId={f.id} kids={[...kids]} />
        </div>
      </main>
    </>
  );
}
