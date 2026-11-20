import { redirect } from "next/navigation";
import { currentStaff } from "../../../lib/staff";
import { loadOpportunities } from "../../../lib/volunteer-db";
import { AdminTop } from "../chrome";
import { VolunteerManager } from "./manager";
import { requireModule, schoolPath } from "../../../lib/portal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Volunteer" };

export default async function VolunteerAdmin() {
  await requireModule("volunteer");
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const opps = await loadOpportunities(staff.schoolId, { includeHidden: true });
  return (
    <>
      <AdminTop signedIn section="volunteer" />
      <main id="main" className="adm-main">
        <VolunteerManager opps={opps.map((o) => ({ ...o }))} />
      </main>
    </>
  );
}
