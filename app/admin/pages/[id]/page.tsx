import { notFound, redirect } from "next/navigation";
import { db } from "../../../../lib/db";
import { currentStaff } from "../../../../lib/staff";
import { AdminTop } from "../../chrome";
import { PageEditor, type EditorPage, type Version } from "./editor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit page" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { staff } = await currentStaff();
  if (!staff) redirect("/admin");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [page] = await db()<EditorPage[]>`
    select id, slug, legacy_path as legacy, draft_title as title, draft_summary as summary, draft_html as html,
      published_at::text as "publishedAt",
      (published_at is not null and (draft_title <> title or draft_summary <> summary or draft_html <> html)) as "unpublishedChanges"
    from pages where id = ${id} and school_id = ${staff.schoolId}`;
  if (!page) notFound();
  const versions = await db()<Version[]>`
    select id, kind, title, author, created_at::text as "createdAt" from page_versions where page_id = ${id} order by created_at desc, id desc limit 50`;
  return (
    <>
      <AdminTop signedIn section="pages" />
      <main className="adm-main adm-main--wide">
        <PageEditor page={{ ...page }} versions={[...versions]} />
      </main>
    </>
  );
}
