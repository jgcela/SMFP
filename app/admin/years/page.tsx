// School years (step 11a): the school's years, the next one, and switching it on.
import { redirect } from "next/navigation";
import { schoolPath } from "../../../lib/portal";
import { currentStaff } from "../../../lib/staff";
import { listYears, nextLabel, plusYear, STATUS_LABEL } from "../../../lib/years";
import { AdminTop, PageHead } from "../chrome";
import { SLink } from "../ui";
import { AddYearForm, EditYearForm, OpenYearButton, SwitchOnForm } from "./forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "School years" };

const day = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
};

export default async function YearsPage() {
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const years = await listYears(staff.schoolId);
  const active = years.find((y) => y.status === "active");
  const preparing = years.find((y) => y.status === "preparing");
  const latest = years[0];
  return (
    <>
      <AdminTop signedIn section="years" />
      <main id="main" className="adm-main">
        <PageHead
          title="School years"
          lead="Families only see the active year. Prepare the next one here, then switch it on. Past years stay archived for the school."
          actions={<SLink className="btn btn--outline" href="/admin/years/grades">Grades</SLink>}
        />
        <section className="adm-card" aria-labelledby="years-title">
          <h2 id="years-title" className="adm-h2">All years</h2>
          <ul className="yr-list">
            {years.map((y) => (
              <li key={y.id} className={`yr-item yr-item--${y.status}`}>
                <div className="yr-main">
                  <p className="yr-name">
                    <strong>{y.label}</strong>
                    <span className={`sp-badge${y.status === "active" ? " is-on" : ""}${y.status === "preparing" ? " is-prep" : ""}`}>{STATUS_LABEL[y.status]}</span>
                    {y.id === staff.yearId && <span className="pill pill--muted">Open in the panel</span>}
                  </p>
                  <p className="note">
                    {day(y.starts_on)} – {day(y.ends_on)}
                    {y.copied_from_label ? ` · Copied from ${y.copied_from_label}` : ""}
                  </p>
                </div>
                <div className="yr-actions">
                  {y.id !== staff.yearId && <OpenYearButton id={y.id} label={y.label} />}
                  {y.status !== "archived" && <SLink className="btn btn--outline btn--sm" href={`/admin/years/promote?year=${y.id}`}>Move children up a grade</SLink>}
                  <EditYearForm id={y.id} label={y.label} startsOn={y.starts_on} endsOn={y.ends_on} />
                </div>
                {y.status === "preparing" && active && !staff.support && (
                  <div className="yr-on">
                    <SwitchOnForm id={y.id} label={y.label} activeLabel={active.label} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
        <section className="adm-card" aria-labelledby="add-title">
          <h2 id="add-title" className="adm-h2">Add the next school year</h2>
          {preparing ? (
            <p>{preparing.label} is being prepared. Fill it in from the panel (choose it under &ldquo;School year&rdquo; in the menu), then switch it on. After that you can add the following year.</p>
          ) : active && latest ? (
            <AddYearForm
              label={nextLabel(latest.label)}
              startsOn={plusYear(latest.starts_on)}
              endsOn={plusYear(latest.ends_on)}
              fromLabel={active.label}
            />
          ) : null}
        </section>
      </main>
    </>
  );
}
