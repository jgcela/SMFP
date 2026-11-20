import { db } from "../../../lib/db";
import { requirePlatformPage } from "../../../lib/platform";
import { PlatformHead, PlatformSide } from "../chrome";
import { LogTable, type LogRow } from "../log-table";

export const metadata = { title: "Activity log" };

export default async function Log() {
  const admin = await requirePlatformPage();
  const rows = await db()<LogRow[]>`
    select a.id::text, a.at, a.user_email, a.action, a.detail, a.school_id, s.name as school
    from platform_audit a left join schools s on s.id = a.school_id
    order by a.at desc, a.id desc limit 300`;
  return (
    <>
      <PlatformSide page="log" email={admin.email} />
      <main id="main" className="adm-main">
        <PlatformHead title="Activity log" lead="Everything FAMITENLY people did: who, what, in which school and when. The newest 300 entries." />
        <div className="adm-card"><LogTable rows={rows} /></div>
      </main>
    </>
  );
}
