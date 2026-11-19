// One family, as the school sees it: contact details, and its children (kept by the school).
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "../../../../lib/db";
import { currentStaff } from "../../../../lib/staff";
import { AdminTop } from "../../chrome";
import { ChildrenFixer, type KidRow } from "./fixer";
import { Head } from "../../ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Family" };

type Fam = { id: number; name: string; email: string; status: string; parentNames: string; phone: string; c2Name: string; c2Phone: string; c2Rel: string };

export default async function FamilyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { staff } = await currentStaff();
  if (!staff) redirect("/admin");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [[f], kids, [counts]] = await Promise.all([
    db()<Fam[]>`
      select f.id, f.name, u.email, f.status, f.parent_names as "parentNames", f.phone,
        f.contact2_name as "c2Name", f.contact2_phone as "c2Phone", f.contact2_relation as "c2Rel"
      from families f join auth_user u on u.id = f.user_id
      where f.id = ${id} and f.school_id = ${staff.schoolId}`,
    db()<KidRow[]>`select id, name, grade, teacher from children where family_id = ${id} and school_id = ${staff.schoolId} order by id`,
    db()<{ open: number }[]>`select count(*)::int as open from family_submissions where family_id = ${id} and school_id = ${staff.schoolId} and status <> 'resolved'`,
  ]);
  if (!f) notFound();
  const dash = (v: string) => v || <span className="note">Not given yet</span>;
  return (
    <>
      <AdminTop signedIn section="families" />
      <main id="main" className="adm-main">
        <Head back={<Link href="/admin/families">← All families</Link>} title={f.name} lead={<>{f.email}{f.status === "disabled" && " · turned off"}</>} />
        <div className="adm-card">
          <h2 className="sp-card-h">Contact details</h2>
          <dl className="my-dl">
            <dt>Parents</dt><dd>{dash(f.parentNames)}</dd>
            <dt>Phone</dt><dd>{f.phone ? <a href={`tel:${f.phone.replace(/[^\d+]/g, "")}`}>{f.phone}</a> : dash("")}</dd>
            <dt>Second adult</dt>
            <dd>{f.c2Name ? <>{f.c2Name}{f.c2Rel && ` (${f.c2Rel})`}{f.c2Phone && <> · <a href={`tel:${f.c2Phone.replace(/[^\d+]/g, "")}`}>{f.c2Phone}</a></>}</> : dash("")}</dd>
          </dl>
          <p className="note">The family keeps these details up to date from “My family”.{counts.open ? <> They have {counts.open} absence{counts.open === 1 ? "" : "s"} or request{counts.open === 1 ? "" : "s"} not resolved: see <Link href="/admin/requests?status=open">Absences &amp; requests</Link>.</> : null}</p>
        </div>
        <div className="adm-card">
          <h2 className="adm-h2">Children</h2>
          <p className="lead">The school keeps this list; the family sees it on “My family” and chooses from it when reporting an absence. Later it will come from FACTS.</p>
          <ChildrenFixer familyId={f.id} kids={[...kids]} />
        </div>
      </main>
    </>
  );
}
