// Move children up a grade (step 11a): the school checks the list, changes any
// row, and saves. In a year being prepared the grades apply when it is switched on.
import { notFound, redirect } from "next/navigation";
import { db } from "../../../../lib/db";
import { schoolPath } from "../../../../lib/portal";
import { currentStaff } from "../../../../lib/staff";
import { LEAVES, nextGrade } from "../../../../lib/year-ops";
import { AdminTop, PageHead } from "../../chrome";
import { SLink } from "../../ui";
import { MoveUpForm, type PromoRow } from "../forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Move children up a grade" };

export default async function PromotePage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const yearId = Number((await searchParams).year ?? 0);
  const [y] = await db()<{ id: number; label: string; status: string }[]>`
    select id, label, status from school_years where id = ${yearId} and school_id = ${staff.schoolId}`;
  if (!y || y.status === "archived") notFound();
  const [[school], kids] = await Promise.all([
    db()<{ grades: string[] }[]>`select grades from schools where id = ${staff.schoolId}`,
    db()<{ id: number; name: string; family: string; grade: string; planned: string | null; leaves: boolean | null }[]>`
      select c.id, c.name, f.name as family, c.grade, cy.grade as planned, cy.leaves
      from children c join families f on f.id = c.family_id
        left join child_years cy on cy.child_id = c.id and cy.year_id = ${y.id}
      where c.school_id = ${staff.schoolId} and not c.left_school and f.status = 'approved'
      order by f.name, c.name, c.id`,
  ]);
  const grades = school?.grades ?? [];
  // In the active year the grade "now" is the one families see; a year being
  // prepared proposes the next grade, unless the school already saved a plan.
  const planned = (k: (typeof kids)[number]) => y.status === "preparing" && k.planned !== null;
  const rows: PromoRow[] = kids.map((k) => {
    if (planned(k)) return { id: k.id, name: k.name, family: k.family, grade: k.grade, proposed: k.leaves ? LEAVES : k.planned!, review: false };
    if (y.status === "active") return { id: k.id, name: k.name, family: k.family, grade: k.grade, proposed: k.grade, review: !grades.includes(k.grade) };
    const next = nextGrade(grades, k.grade);
    return { id: k.id, name: k.name, family: k.family, grade: k.grade, proposed: next ?? k.grade, review: next === null };
  });
  return (
    <>
      <AdminTop signedIn section="years" />
      <main id="main" className="adm-main">
        <PageHead
          title={`Move children up a grade · ${y.label}`}
          lead={y.status === "preparing"
            ? "Each child gets the next grade in the school's list. Check the list, change any row, then save."
            : "Change a child's grade for this year, or mark that they leave the school."}
          actions={<SLink className="btn btn--outline" href="/admin/years">← School years</SLink>}
        />
        <section className="adm-card">
          {rows.length ? (
            <MoveUpForm yearId={y.id} rows={rows} grades={grades} leaves={LEAVES} applyNow={y.status === "active"} />
          ) : (
            <p>There are no children of approved families yet.</p>
          )}
          <p className="note">The order of grades comes from <SLink href="/admin/years/grades">Grades</SLink>.</p>
        </section>
      </main>
    </>
  );
}
