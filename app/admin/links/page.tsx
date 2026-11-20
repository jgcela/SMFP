import { redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { currentStaff } from "../../../lib/staff";
import { AdminTop } from "../chrome";
import { LinksManager, type AdminLink } from "./manager";
import { schoolPath } from "../../../lib/portal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Links" };

export default async function LinksPage() {
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const [links, cats, pages] = await Promise.all([
    db()<AdminLink[]>`
      select id, placement, label, short_label as "shortLabel", href, new_tab as "newTab", hidden
      from links where school_id = ${staff.schoolId} and year_id = ${staff.yearId} and placement in ('popular', 'top', 'facts') order by sort_order, id`,
    db()<{ key: string; name: string }[]>`
      select key, name from document_categories where school_id = ${staff.schoolId} and year_id = ${staff.yearId} order by sort_order, id`,
    db()<{ slug: string; title: string; legacy: string }[]>`
      select slug, coalesce(nullif(title, ''), draft_title) as title, legacy_path as legacy from pages where school_id = ${staff.schoolId} and year_id = ${staff.yearId} order by title`,
  ]);
  return (
    <>
      <AdminTop signedIn section="links" />
      <main id="main" className="adm-main">
        <LinksManager links={[...links]} categories={[...cats]} pages={[...pages]} />
      </main>
    </>
  );
}
