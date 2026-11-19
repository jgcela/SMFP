// Staff favorites (step 6c): built from the school's staff cards. Only families the
// school approved (and its staff) see them; anyone else gets a sign-in notice.
import { loadPortal, schoolSlug } from "../../lib/portal";
import { renderStaffPage } from "../../lib/render";
import { loadStaffCards, loadStaffPage, staffViewer } from "../../lib/staff-favorites-db";

export const dynamic = "force-dynamic";

export async function GET() {
  const { school, links, contacts } = await loadPortal(schoolSlug());
  const viewer = await staffViewer();
  const [page, cards] = await Promise.all([loadStaffPage(school.id), viewer === "allowed" ? loadStaffCards(school.id) : Promise.resolve([])]);
  const html = renderStaffPage(school, links, contacts, page, [...cards], viewer);
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
