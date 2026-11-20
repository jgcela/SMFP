// Teacher wishlists (step 6d): built from the school's wishlists. Only families the
// school approved (and its staff) see them; anyone else gets a sign-in notice.
import { loadPortal, schoolSlug, moduleOn } from "../../lib/portal";
import { renderWishlistPage } from "../../lib/render";
import { staffAnchors } from "../../lib/staff-favorites";
import { loadStaffCards, loadStaffPage, staffViewer } from "../../lib/staff-favorites-db";
import { loadWishlistPage, loadWishlists } from "../../lib/wishlists-db";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await moduleOn("wishlists"))) return new Response("Not found", { status: 404 });
  const { school, links, contacts } = await loadPortal(await schoolSlug());
  const viewer = await staffViewer();
  const allowed = viewer === "allowed";
  const [page, lists, cards, staffPage] = await Promise.all([
    loadWishlistPage(school.id),
    allowed ? loadWishlists(school.id) : Promise.resolve([]),
    allowed ? loadStaffCards(school.id) : Promise.resolve([]),
    loadStaffPage(school.id),
  ]);
  // "Favorite things" goes to the teacher's card, when it is on the Staff favorites page.
  const anchors = staffAnchors([...cards], staffPage.teams);
  const html = renderWishlistPage(school, links, contacts, page, [...lists], viewer, anchors);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
