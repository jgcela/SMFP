import { redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { currentStaff } from "../../../lib/staff";
import { AdminTop } from "../chrome";
import { FamiliesManager, type FamilyRow } from "./manager";
import { schoolPath } from "../../../lib/portal";
import { requirePanelModule } from "../../../lib/years";

export const dynamic = "force-dynamic";
export const metadata = { title: "Families" };

export default async function FamiliesPage() {
  await requirePanelModule("families");
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const [families, [school]] = await Promise.all([
    db()<FamilyRow[]>`
      select f.id, f.name, f.status,
        coalesce((select string_agg(u.email, ', ' order by fu.created_at) from family_users fu join auth_user u on u.id = fu.user_id where fu.family_id = f.id), '') as email,
        f.facts_family_id is not null as "fromFacts",
        -- Its own children, and the FACTS students of its FACTS family placed in another family (same as the family page).
        coalesce((select json_agg(json_build_object('name', c.name, 'grade', c.grade) order by c.name, c.id) from children c
          where c.school_id = f.school_id and not c.left_school and (c.family_id = f.id or (f.facts_family_id is not null and c.facts_id in (
            select s.student_facts_id from facts_family_students s where s.school_id = f.school_id and s.family_facts_id = f.facts_family_id)))), '[]') as kids,
        -- FACTS parents of the family who can see at least one student: the ones the school can invite.
        coalesce((select json_agg(json_build_object('id', p.parent_facts_id, 'email', coalesce(p.email, ''), 'active', p.user_id is not null) order by p.parent_facts_id)
          from facts_family_parents fp join facts_parents p on p.school_id = fp.school_id and p.parent_facts_id = fp.parent_facts_id
          where fp.school_id = f.school_id and fp.family_facts_id = f.facts_family_id
            and exists (select 1 from facts_student_access g where g.school_id = p.school_id and g.parent_facts_id = p.parent_facts_id and g.state = 'granted')), '[]') as parents
      from families f
      where f.school_id = ${staff.schoolId}
      order by f.created_at desc, f.id desc`,
    db()<{ family_code: string | null }[]>`select family_code from schools where id = ${staff.schoolId}`,
  ]);
  return (
    <>
      <AdminTop signedIn section="families" />
      <main id="main" className="adm-main">
        <FamiliesManager families={[...families]} code={school?.family_code ?? ""} />
      </main>
    </>
  );
}
