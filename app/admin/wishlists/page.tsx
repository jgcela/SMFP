import { redirect } from "next/navigation";
import { currentStaff } from "../../../lib/staff";
import { loadStaffCards } from "../../../lib/staff-favorites-db";
import { loadWishlistPage, loadWishlists } from "../../../lib/wishlists-db";
import { AdminTop } from "../chrome";
import { WishlistsManager } from "./manager";
import { schoolPath } from "../../../lib/portal";
import { requirePanelModule } from "../../../lib/years";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wishlists" };

export default async function WishlistsAdmin() {
  await requirePanelModule("wishlists");
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const [lists, page, cards] = await Promise.all([
    loadWishlists(staff.yearId, { includeHidden: true }),
    loadWishlistPage(staff.yearId),
    loadStaffCards(staff.yearId, { includeHidden: true }),
  ]);
  return (
    <>
      <AdminTop signedIn section="wishlists" />
      <main id="main" className="adm-main">
        <WishlistsManager
          lists={lists.map((l) => ({ ...l }))}
          groups={page.groups}
          teachers={cards.map((c) => ({ id: c.id, name: c.name, role: c.role }))}
        />
      </main>
    </>
  );
}
