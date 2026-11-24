// Who signed up for one volunteer opportunity, with a CSV download.
import { notFound, redirect } from "next/navigation";
import { db } from "../../../../lib/db";
import { when } from "../../../../lib/my-family";
import { currentStaff } from "../../../../lib/staff";
import { OPP_COLUMNS, spotsLabel, whenLabel, type Opportunity } from "../../../../lib/volunteer";
import { AdminTop } from "../../chrome";
import { loadSignups } from "./signups";
import { Head, SLink } from "../../ui";
import { schoolPath } from "../../../../lib/portal";
import { requirePanelModule } from "../../../../lib/years";

export const dynamic = "force-dynamic";
export const metadata = { title: "Volunteer sign-ups" };

export default async function SignupsPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePanelModule("volunteer");
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const sql = db();
  const [[o], [s]] = await Promise.all([
    sql<Opportunity[]>`select ${sql.unsafe(OPP_COLUMNS)} from volunteer_opportunities o where o.id = ${id} and o.school_id = ${staff.schoolId} and o.year_id = ${staff.yearId}`,
    sql<{ timezone: string }[]>`select timezone from schools where id = ${staff.schoolId}`,
  ]);
  if (!o) notFound();
  const rows = await loadSignups(staff.schoolId, id);
  const tz = s?.timezone || "UTC";
  return (
    <>
      <AdminTop signedIn section="volunteer" />
      <main id="main" className="adm-main">
        <Head back={<SLink href="/admin/volunteer">← All opportunities</SLink>} title={o.title}
          lead={<>{[whenLabel(o), o.location, spotsLabel(o)].filter(Boolean).join(" · ")}{o.hidden && " · hidden"}</>}
          actions={rows.length > 0 ? <a className="btn btn--outline" href={`/admin/volunteer/${o.id}/csv`} download>Download CSV</a> : undefined} />
        <div className="adm-card">
          <h2 className="sp-card-h">Who signed up</h2>
          {rows.length ? (
            <div className="adm-tablewrap">
              <table className="adm-table">
                <thead><tr><th>Family</th><th>Parents</th><th>Phone</th><th>Email</th><th>Signed up</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.familyId}>
                      <td><SLink href={`/admin/families/${r.familyId}`}>{r.family}</SLink></td>
                      <td>{r.parents}</td>
                      <td>{r.phone && <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a>}</td>
                      <td><a href={`mailto:${r.email}`}>{r.email}</a></td>
                      <td>{when(r.signedUp, tz)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="adm-empty">{o.portalSignup ? "No families have signed up yet." : "Families sign up for this one outside the portal (its own button), so there is no list here."}</p>}
        </div>
      </main>
    </>
  );
}
