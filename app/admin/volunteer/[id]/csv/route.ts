// The sign-ups of one opportunity as a CSV file (opens in Excel or Google Sheets).
import { db } from "../../../../../lib/db";
import { when } from "../../../../../lib/my-family";
import { currentStaff } from "../../../../../lib/staff";
import { whenLabel } from "../../../../../lib/volunteer";
import { loadSignups } from "../signups";

export const dynamic = "force-dynamic";

// Quotes every cell; a cell that starts like a formula is kept as text.
const cell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { staff } = await currentStaff();
  if (!staff) return new Response("Sign in as staff first.", { status: 401 });
  const id = Number((await ctx.params).id);
  const [o] = await db()<{ title: string; eventDate: string | null; startTime: string | null; endTime: string | null; whenText: string; timezone: string }[]>`
    select o.title, o.event_date::text as "eventDate", to_char(o.start_time, 'HH24:MI') as "startTime", to_char(o.end_time, 'HH24:MI') as "endTime",
      o.when_text as "whenText", s.timezone
    from volunteer_opportunities o join schools s on s.id = o.school_id
    where o.id = ${Number.isInteger(id) ? id : 0} and o.school_id = ${staff.schoolId} and o.year_id = ${staff.yearId}`;
  if (!o) return new Response("Not found", { status: 404 });
  const rows = await loadSignups(staff.schoolId, id);
  const lines = [
    ["Opportunity", "When", "Family", "Parents", "Phone", "Email", "Second adult", "Signed up"],
    ...rows.map((r) => [o.title, whenLabel(o), r.family, r.parents, r.phone, r.email, r.contact2, when(r.signedUp, o.timezone || "UTC")]),
  ];
  const body = "﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n";
  const name = o.title.replace(/[^\w -]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "volunteer";
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-signups.csv"`, "Cache-Control": "private, no-store" },
  });
}
