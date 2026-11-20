import { redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { currentStaff } from "../../../lib/staff";
import { AdminTop } from "../chrome";
import { PagesList, type PageRow } from "./list";
import { schoolPath } from "../../../lib/portal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pages" };

export default async function PagesPage() {
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const pages = await db()<PageRow[]>`
    select id, slug, draft_title as title, legacy_path as legacy, published_at::text as "publishedAt", updated_at::text as "updatedAt",
      (published_at is not null and (draft_title <> title or draft_summary <> summary or draft_html <> html)) as "unpublishedChanges"
    from pages where school_id = ${staff.schoolId} order by draft_title`;
  return (
    <>
      <AdminTop signedIn section="pages" />
      <main id="main" className="adm-main">
        <PagesList pages={[...pages]} />
      </main>
    </>
  );
}
