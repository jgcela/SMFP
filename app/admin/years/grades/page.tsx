// The school's grades in order (step 11a), used to move children up a grade.
import { redirect } from "next/navigation";
import { db } from "../../../../lib/db";
import { schoolPath } from "../../../../lib/portal";
import { currentStaff } from "../../../../lib/staff";
import { AdminTop, PageHead } from "../../chrome";
import { SLink } from "../../ui";
import { GradesForm } from "../forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Grades" };

export default async function GradesPage() {
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const [s] = await db()<{ grades: string[] }[]>`select grades from schools where id = ${staff.schoolId}`;
  return (
    <>
      <AdminTop signedIn section="years" />
      <main id="main" className="adm-main">
        <PageHead title="Grades" lead="The school's grades in order. Moving children up a grade uses this list." actions={<SLink className="btn btn--outline" href="/admin/years">← School years</SLink>} />
        <section className="adm-card">
          <GradesForm grades={s?.grades ?? []} />
        </section>
      </main>
    </>
  );
}
