import { redirect } from "next/navigation";
import { currentStaff } from "../../../lib/staff";
import { loadStaffCards } from "../../../lib/staff-favorites-db";
import { loadWishlistPage, loadWishlists } from "../../../lib/wishlists-db";
import { AdminTop } from "../chrome";
import { WishlistsManager } from "./manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Wishlists" };

export default async function WishlistsAdmin() {
  const { staff } = await currentStaff();
  if (!staff) redirect("/admin");
  const [lists, page, cards] = await Promise.all([
    loadWishlists(staff.schoolId, { includeHidden: true }),
    loadWishlistPage(staff.schoolId),
    loadStaffCards(staff.schoolId, { includeHidden: true }),
  ]);
  return (
    <>
      <AdminTop signedIn section="wishlists" />
      <main className="adm-main">
        <WishlistsManager
          lists={lists.map((l) => ({ ...l }))}
          groups={page.groups}
          teachers={cards.map((c) => ({ id: c.id, name: c.name, role: c.role }))}
        />
      </main>
    </>
  );
}
