import { notFound } from "next/navigation";
import { db } from "../../../../lib/db";
import { requirePlatformPage } from "../../../../lib/platform";
import { MODULES, PLANS, planOf, price, STATUS_NAME, type SchoolStatus } from "../../../../lib/plans";
import { endSupport, startSupport } from "../../actions";
import { PlatformHead, PlatformSide } from "../../chrome";
import { InviteForm, PlanModulesForm, StatusForm } from "../../forms";
import { LogTable, when, type LogRow } from "../../log-table";

export const metadata = { title: "School" };

type Row = {
  id: number; slug: string; name: string; plan: string; status: SchoolStatus; modules: string[]; timezone: string; created_at: Date;
  support_until: Date | null; families: number; pending: number;
};

export default async function SchoolPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string; support?: string }> }) {
  const admin = await requirePlatformPage();
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [s] = await db()<Row[]>`
    select s.id, s.slug, s.name, s.plan, s.status, s.modules, s.timezone, s.created_at, s.support_until,
      (select count(*)::int from families f where f.school_id = s.id and f.status = 'approved') as families,
      (select count(*)::int from families f where f.school_id = s.id and f.status = 'pending') as pending
    from schools s where s.id = ${id}`;
  if (!s) notFound();
  const [staff, log, [visit]] = await Promise.all([
    db()<{ email: string; role: string; ready: boolean }[]>`
      select u.email, ss.role, exists (select 1 from auth_account a where a.user_id = u.id and a.provider_id = 'credential' and a.password is not null) as ready
      from school_staff ss join auth_user u on u.id = ss.user_id where ss.school_id = ${id} order by ss.created_at, u.email`,
    db()<LogRow[]>`
      select a.id::text, a.at, a.user_email, a.action, a.detail, a.school_id, null as school
      from platform_audit a where a.school_id = ${id} order by a.at desc, a.id desc limit 50`,
    db()<{ expires_at: Date }[]>`select expires_at from platform_support where session_id = ${admin.sessionId} and school_id = ${id} and expires_at > now()`,
  ]);
  const allowed = s.support_until && s.support_until > new Date() && s.status !== "suspended";
  const plans = PLANS.map((p) => ({ id: p.id, name: p.name, price: price(p), summary: p.summary }));
  return (
    <>
      <PlatformSide page="schools" email={admin.email} />
      <main id="main" className="adm-main">
        <PlatformHead title={s.name} back={<a href="/platform">← All schools</a>}
          lead={<>Portal: <a href={`/s/${s.slug}/`} target="_blank" rel="noopener">/s/{s.slug}/</a> · Staff panel: <a href={`/s/${s.slug}/admin`} target="_blank" rel="noopener">/s/{s.slug}/admin</a></>} />
        {sp.created && (
          <p className={`adm-msg ${sp.created === "sent" ? "adm-msg--ok" : "adm-msg--err"}`} role="status">
            {sp.created === "sent" ? "School created. The first administrator has an email invitation." : "School created, but the invitation email could not be sent. Send it again below."}
          </p>
        )}
        {sp.support === "denied" && <p className="adm-msg adm-msg--err" role="alert">The school has not allowed support access right now.</p>}

        <section className="adm-card" aria-labelledby="sum">
          <h2 id="sum" className="adm-h2">Summary</h2>
          <dl className="pf-facts">
            <div><dt>State</dt><dd><span className={`pf-status pf-status--${s.status}`}>{STATUS_NAME[s.status]}</span></dd></div>
            <div><dt>Plan</dt><dd>{planOf(s.plan).name}</dd></div>
            <div><dt>Families</dt><dd>{s.families}{s.pending ? ` (+${s.pending} waiting)` : ""}</dd></div>
            <div><dt>Time zone</dt><dd>{s.timezone}</dd></div>
            <div><dt>Created</dt><dd>{when(s.created_at)}</dd></div>
          </dl>
        </section>

        <section className="adm-card" aria-labelledby="st">
          <h2 id="st" className="adm-h2">State</h2>
          <StatusForm key={s.status} schoolId={s.id} status={s.status} name={s.name} />
        </section>

        <section className="adm-card" aria-labelledby="pm">
          <h2 id="pm" className="adm-h2">Plan and modules</h2>
          <PlanModulesForm schoolId={s.id} plan={s.plan} modules={s.modules} plans={plans}
            options={MODULES.map((m) => ({ id: m.id, name: m.name, lead: m.lead, available: m.available, plans: m.plans }))} />
        </section>

        <section className="adm-card" aria-labelledby="sup">
          <h2 id="sup" className="adm-h2">Support</h2>
          {visit ? (
            <>
              <p>You are in this school&rsquo;s staff panel in support mode until {when(visit.expires_at)}.</p>
              <div className="adm-actions">
                <a className="btn btn--primary" href={`/s/${s.slug}/admin`}>Go to the staff panel</a>
                <form action={endSupport}><input type="hidden" name="school_id" value={s.id} /><button type="submit" className="btn btn--outline">End support visit</button></form>
              </div>
            </>
          ) : allowed ? (
            <>
              <p>The school allows support access until {when(s.support_until!)}. A visit lasts up to 1 hour, shows a &ldquo;Support mode&rdquo; strip in the panel, and every change is recorded.</p>
              <form action={startSupport} className="adm-actions"><input type="hidden" name="school_id" value={s.id} /><button type="submit" className="btn btn--primary">Enter staff panel (support mode)</button></form>
            </>
          ) : (
            <p>The school has not allowed support access. An administrator of the school can allow it for a limited time in the staff panel, under Settings.</p>
          )}
        </section>

        <section className="adm-card" aria-labelledby="ad">
          <h2 id="ad" className="adm-h2">Administrators</h2>
          {staff.length ? (
            <ul className="adm-list">
              {staff.map((p) => <li key={p.email} className="adm-doc"><div className="what"><strong>{p.email}</strong><span className="note">{p.ready ? "Has signed up" : "Invitation not accepted yet"}</span></div></li>)}
            </ul>
          ) : <p className="adm-empty">No administrators yet.</p>}
          <InviteForm schoolId={s.id} />
        </section>

        <section className="adm-card" aria-labelledby="lg">
          <h2 id="lg" className="adm-h2">Activity in this school</h2>
          <LogTable rows={log} showSchool={false} />
        </section>
      </main>
    </>
  );
}
