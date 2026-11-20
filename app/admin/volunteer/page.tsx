import { redirect } from "next/navigation";
import { currentStaff } from "../../../lib/staff";
import { loadOpportunities } from "../../../lib/volunteer-db";
import { AdminTop } from "../chrome";
import { VolunteerManager } from "./manager";
import { schoolPath } from "../../../lib/portal";
import { requirePanelModule } from "../../../lib/years";

export const dynamic = "force-dynamic";
export const metadata = { title: "Volunteer" };

export default async function VolunteerAdmin() {
  await requirePanelModule("volunteer");
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const opps = await loadOpportunities(staff.yearId, { includeHidden: true });
  return (
    <>
      <AdminTop signedIn section="volunteer" />
      <main id="main" className="adm-main">
        <VolunteerManager opps={opps.map((o) => ({ ...o }))} />
      </main>
    </>
  );
}
