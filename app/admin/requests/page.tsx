// "Absences & requests": everything families of this school send, with filters.
// Filters live in the address (?from=&to=&status=&kind=) so a filtered view can be reloaded.
import { redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { formatRange, STATUS_LABEL, todayIn, when, type SubmissionKind, type SubmissionStatus } from "../../../lib/my-family";
import { currentStaff } from "../../../lib/staff";
import { AdminTop } from "../chrome";
import { RequestsList, type StaffRow } from "./list";

export const dynamic = "force-dynamic";
export const metadata = { title: "Absences & requests" };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function RequestsPage({ searchParams }: { searchParams: Search }) {
  const { staff } = await currentStaff();
  if (!staff) redirect("/admin");
  const sp = await searchParams;
  const one = (k: string) => { const v = sp[k]; return typeof v === "string" ? v : ""; };
  const from = ISO.test(one("from")) ? one("from") : "";
  const to = ISO.test(one("to")) ? one("to") : "";
  const status = one("status") === "open" || one("status") in STATUS_LABEL ? one("status") : "";
  const kind = one("kind") === "absence" || one("kind") === "request" ? (one("kind") as SubmissionKind) : "";

  const [school] = await db()<{ timezone: string }[]>`select timezone from schools where id = ${staff.schoolId}`;
  const tz = school?.timezone || "UTC";
  const sql = db();
  const rows = await sql<(Omit<StaffRow, "dates" | "sentAt" | "changedAt"> & { createdAt: string; statusAt: string | null })[]>`
    select s.id, s.kind, s.category, s.child_name as "childName", s.date_from::text as "dateFrom", s.date_to::text as "dateTo",
      s.message, s.status, s.created_at::text as "createdAt", s.status_at::text as "statusAt", s.status_by as "statusBy",
      f.id as "familyId", f.name as "familyName", f.phone, f.parent_names as "parentNames"
    from family_submissions s join families f on f.id = s.family_id and f.school_id = s.school_id
    where s.school_id = ${staff.schoolId}
      ${from ? sql`and s.date_to >= ${from}` : sql``}
      ${to ? sql`and s.date_from <= ${to}` : sql``}
      ${status === "open" ? sql`and s.status <> 'resolved'` : status ? sql`and s.status = ${status}` : sql``}
      ${kind ? sql`and s.kind = ${kind}` : sql``}
    order by s.date_from desc, s.created_at desc
    limit 500`;
  const list: StaffRow[] = rows.map((r) => ({
    ...r,
    status: r.status as SubmissionStatus,
    dates: formatRange(r.dateFrom, r.dateTo),
    sentAt: when(r.createdAt, tz),
    changedAt: r.statusAt ? when(r.statusAt, tz) : "",
  }));
  return (
    <>
      <AdminTop signedIn section="requests" />
      <main id="main" className="adm-main">
        <RequestsList rows={list} filters={{ from, to, status, kind }} today={todayIn(tz)} tomorrow={todayIn(tz, 1)} week={todayIn(tz, 6)} />
      </main>
    </>
  );
}
