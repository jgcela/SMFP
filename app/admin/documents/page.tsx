import { redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { currentStaff } from "../../../lib/staff";
import { getStorage, storageConfigured } from "../../../lib/storage";
import { AdminTop } from "../chrome";
import { DocumentsManager, type AdminCategory, type AdminDoc } from "./manager";
import { schoolPath } from "../../../lib/portal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const [cats, docs, storageReady] = await Promise.all([
    db()<AdminCategory[]>`
      select id, key, name, description from document_categories where school_id = ${staff.schoolId} and year_id = ${staff.yearId} order by sort_order, id`,
    db()<AdminDoc[]>`
      select id, category_id as "categoryId", title, description, href, meta, kind, most_used_rank is not null as "mostUsed",
        file_key is not null as "uploaded", file_name as "fileName", review_from as "reviewFrom"
      from documents where school_id = ${staff.schoolId} and year_id = ${staff.yearId} order by sort_order, id`,
    storageConfigured() ? getStorage().ping() : Promise.resolve(false),
  ]);
  return (
    <>
      <AdminTop signedIn section="documents" />
      <main id="main" className="adm-main">
        <DocumentsManager categories={[...cats]} docs={[...docs]} storageReady={storageReady} />
      </main>
    </>
  );
}
