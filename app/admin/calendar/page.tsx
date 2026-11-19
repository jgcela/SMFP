import { redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { currentStaff } from "../../../lib/staff";
import { AdminTop } from "../chrome";
import { CalendarManager, type AdminEvent } from "./manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ imported?: string; skipped?: string }> }) {
  const [{ staff }, sp] = await Promise.all([currentStaff(), searchParams]);
  if (!staff) redirect("/admin");
  const events = await db()<AdminEvent[]>`
    select id, event_date::text as date, end_date::text as "endDate", to_char(start_time, 'HH24:MI') as time,
      category, title, details as note
    from events where school_id = ${staff.schoolId}
    order by event_date, sort_order, id`;
  const imported = Number(sp.imported ?? NaN);
  const skipped = Number(sp.skipped ?? 0);
  const notice = Number.isFinite(imported)
    ? `Imported ${imported} event${imported === 1 ? "" : "s"}.${skipped ? ` ${skipped} already in the calendar were skipped.` : ""}`
    : undefined;
  return (
    <>
      <AdminTop signedIn section="calendar" />
      <main id="main" className="adm-main">
        <CalendarManager events={[...events]} notice={notice} />
      </main>
    </>
  );
}
