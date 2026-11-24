// FACTS access (staff): import the FACTS Parents Web report, see each FACTS
// parent's account status and invite them. Only this school's data.
import { redirect } from "next/navigation";
import { db } from "../../../../lib/db";
import type { Db } from "../../../../lib/facts-access";
import { listParents } from "../../../../lib/facts-accounts";
import { schoolPath } from "../../../../lib/portal";
import { currentStaff } from "../../../../lib/staff";
import { requirePanelModule } from "../../../../lib/years";
import { AdminTop } from "../../chrome";
import { FactsManager } from "./manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "FACTS access" };

export default async function FactsPage() {
  await requirePanelModule("families");
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const parents = await listParents(db() as unknown as Db, staff.schoolId);
  return (
    <>
      <AdminTop signedIn section="families" />
      <main id="main" className="adm-main">
        <FactsManager parents={[...parents]} />
      </main>
    </>
  );
}
