import { redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { currentStaff } from "../../../lib/staff";
import { AdminTop } from "../chrome";
import { FamiliesManager, type FamilyRow } from "./manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Families" };

export default async function FamiliesPage() {
  const { staff } = await currentStaff();
  if (!staff) redirect("/admin");
  const [families, [school]] = await Promise.all([
    db()<FamilyRow[]>`
      select f.id, f.name, u.email, f.status, f.created_at::text as "createdAt", f.decided_at::text as "decidedAt", f.decided_by as "decidedBy"
      from families f join auth_user u on u.id = f.user_id
      where f.school_id = ${staff.schoolId}
      order by f.created_at desc, f.id desc`,
    db()<{ family_code: string | null }[]>`select family_code from schools where id = ${staff.schoolId}`,
  ]);
  return (
    <>
      <AdminTop signedIn section="families" />
      <main className="adm-main">
        <FamiliesManager families={[...families]} code={school?.family_code ?? ""} />
      </main>
    </>
  );
}
