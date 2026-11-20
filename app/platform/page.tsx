import { db } from "../../lib/db";
import { requirePlatformPage } from "../../lib/platform";
import { planOf, STATUS_NAME, type SchoolStatus } from "../../lib/plans";
import { PlatformHead, PlatformSide } from "./chrome";

export const metadata = { title: "Schools" };

const date = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Denver" });

export default async function Schools({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const admin = await requirePlatformPage();
  const q = ((await searchParams).q ?? "").trim().slice(0, 100);
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = await db()<{ id: number; name: string; slug: string; plan: string; status: SchoolStatus; families: number; created_at: Date }[]>`
    select s.id, s.name, s.slug, s.plan, s.status, s.created_at,
      (select count(*)::int from families f where f.school_id = s.id and f.status = 'approved') as families
    from schools s
    where ${q} = '' or s.name ilike ${like} or s.slug ilike ${like}
    order by s.created_at desc, s.id desc`;
  return (
    <>
      <PlatformSide page="schools" email={admin.email} />
      <main id="main" className="adm-main">
        <PlatformHead title="Schools" lead="Every school on FAMITENLY. Open one to change its plan, modules or state."
          actions={<a className="btn btn--primary" href="/platform/schools/new">New school</a>} />
        <div className="adm-card">
          <form className="sp-tools" role="search" action="/platform">
            <label className="sp-search">
              <span className="sr-only">Search schools by name or code</span>
              <svg className="sp-ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <input type="search" name="q" defaultValue={q} placeholder="Search by name or code" />
            </label>
            <button type="submit" className="btn btn--outline">Search</button>
            {q && <a href="/platform">Show all</a>}
          </form>
          {rows.length ? (
            <div className="adm-tablewrap">
              <table className="adm-table pf-table">
                <caption className="sr-only">Schools{q ? ` matching “${q}”` : ""}</caption>
                <thead><tr><th scope="col">Name</th><th scope="col">Code</th><th scope="col">Plan</th><th scope="col">State</th><th scope="col">Families</th><th scope="col">Created</th></tr></thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id}>
                      <td><a href={`/platform/schools/${s.id}`}>{s.name}</a></td>
                      <td>{s.slug}</td>
                      <td>{planOf(s.plan).name}</td>
                      <td><span className={`pf-status pf-status--${s.status}`}>{STATUS_NAME[s.status]}</span></td>
                      <td>{s.families}</td>
                      <td>{date(s.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="adm-empty">{q ? `No school matches “${q}”.` : "No schools yet."}</p>
          )}
        </div>
      </main>
    </>
  );
}
