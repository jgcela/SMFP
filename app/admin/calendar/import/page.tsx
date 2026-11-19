import { redirect } from "next/navigation";
import { currentStaff } from "../../../../lib/staff";
import { AdminTop } from "../../chrome";
import { Importer } from "./importer";

export const dynamic = "force-dynamic";
export const metadata = { title: "Import events" };

export default async function ImportPage() {
  const { staff } = await currentStaff();
  if (!staff) redirect("/admin");
  return (
    <>
      <AdminTop signedIn section="calendar" />
      <main id="main" className="adm-main">
        <Importer />
      </main>
    </>
  );
}
