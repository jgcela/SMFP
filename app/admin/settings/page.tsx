import { redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { currentStaff } from "../../../lib/staff";
import { ChangeEmailForm } from "../../account/forms";
import { AdminTop, PageHead } from "../chrome";
import { NotifyEmailForm } from "./forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { staff } = await currentStaff();
  if (!staff) redirect("/admin");
  const [s] = await db()<{ notify_email: string }[]>`select notify_email from schools where id = ${staff.schoolId}`;
  return (
    <>
      <AdminTop signedIn section="settings" />
      <main id="main" className="adm-main">
        <PageHead title="Settings" lead="Your account, and the emails the school receives." />
        <section className="adm-card" aria-labelledby="acc-title">
          <h2 id="acc-title" className="adm-h2">Your email</h2>
          <ChangeEmailForm current={staff.email} />
        </section>
        <section className="adm-card" aria-labelledby="notify-title">
          <h2 id="notify-title" className="adm-h2">School emails</h2>
          <NotifyEmailForm value={s?.notify_email ?? ""} />
        </section>
      </main>
    </>
  );
}
