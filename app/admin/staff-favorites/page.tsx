import { redirect } from "next/navigation";
import { currentStaff } from "../../../lib/staff";
import { loadStaffCards, loadStaffPage } from "../../../lib/staff-favorites-db";
import { getStorage, storageConfigured } from "../../../lib/storage";
import { AdminTop } from "../chrome";
import { StaffFavoritesManager } from "./manager";
import { requireModule, schoolPath } from "../../../lib/portal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Staff favorites" };

export default async function StaffFavoritesAdmin() {
  await requireModule("staff_favorites");
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const [cards, page, storageReady] = await Promise.all([
    loadStaffCards(staff.schoolId, { includeHidden: true }),
    loadStaffPage(staff.schoolId),
    storageConfigured() ? getStorage().ping() : Promise.resolve(false),
  ]);
  return (
    <>
      <AdminTop signedIn section="staff-favorites" />
      <main id="main" className="adm-main">
        <StaffFavoritesManager cards={cards.map((c) => ({ ...c }))} teams={page.teams} storageReady={storageReady} />
      </main>
    </>
  );
}
