import { redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { currentStaff } from "../../../lib/staff";
import { ChangeEmailForm } from "../../account/forms";
import { AdminTop, PageHead } from "../chrome";
import { NotifyEmailForm, SupportAccessForm } from "./forms";
import { schoolPath } from "../../../lib/portal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { staff } = await currentStaff();
  if (!staff) redirect(await schoolPath("/admin"));
  const [s] = await db()<{ notify_email: string; support_until: Date | null; timezone: string }[]>`
    select notify_email, case when support_until > now() then support_until end as support_until, timezone from schools where id = ${staff.schoolId}`;
  const until = s?.support_until
    ? s.support_until.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: s.timezone || "UTC", timeZoneName: "short" })
    : null;
  return (
    <>
      <AdminTop signedIn section="settings" />
      <main id="main" className="adm-main">
        <PageHead title="Settings" lead="Your account, and the emails the school receives." />
        {!staff.support && (
          <section className="adm-card" aria-labelledby="acc-title">
            <h2 id="acc-title" className="adm-h2">Your email</h2>
            <ChangeEmailForm current={staff.email} />
          </section>
        )}
        <section className="adm-card" aria-labelledby="notify-title">
          <h2 id="notify-title" className="adm-h2">School emails</h2>
          <NotifyEmailForm value={s?.notify_email ?? ""} />
        </section>
        {!staff.support && (
          <section className="adm-card" aria-labelledby="support-title">
            <h2 id="support-title" className="adm-h2">FAMITENLY support access</h2>
            <SupportAccessForm until={until} />
          </section>
        )}
      </main>
    </>
  );
}
