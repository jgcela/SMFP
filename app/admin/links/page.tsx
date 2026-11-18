import { redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { currentStaff } from "../../../lib/staff";
import { AdminTop } from "../chrome";
import { LinksManager, type AdminLink } from "./manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Links" };

export default async function LinksPage() {
  const { staff } = await currentStaff();
  if (!staff) redirect("/admin");
  const [links, cats] = await Promise.all([
    db()<AdminLink[]>`
      select id, placement, label, short_label as "shortLabel", href, new_tab as "newTab", hidden
      from links where school_id = ${staff.schoolId} and placement in ('popular', 'top', 'facts') order by sort_order, id`,
    db()<{ key: string; name: string }[]>`
      select key, name from document_categories where school_id = ${staff.schoolId} order by sort_order, id`,
  ]);
  return (
    <>
      <AdminTop signedIn section="links" />
      <main className="adm-main">
        <LinksManager links={[...links]} categories={[...cats]} />
      </main>
    </>
  );
}
