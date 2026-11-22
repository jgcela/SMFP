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
      select f.id, f.name, f.status, f.created_at::text as "createdAt", f.decided_at::text as "decidedAt", f.decided_by as "decidedBy",
        coalesce((select string_agg(u.email, ', ' order by fu.created_at) from family_users fu join auth_user u on u.id = fu.user_id where fu.family_id = f.id), '') as email,
        f.facts_family_id is not null as "fromFacts",
        (select count(*)::int from children c where c.family_id = f.id and not c.left_school) as kids
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
