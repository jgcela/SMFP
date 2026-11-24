import { redirect } from "next/navigation";
import { currentFamily } from "../../../lib/family";
import { ChangeEmailForm } from "../../account/forms";
import { AdminTop, PageHead } from "../../admin/chrome";
import { schoolPath } from "../../../lib/portal";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function FamilySettingsPage() {
  const family = await currentFamily();
  if (!family) redirect(await schoolPath("/family"));
  return (
    <>
      <AdminTop signedIn area="family" familyPage="settings" />
      <main id="main" className="adm-main">
        <PageHead title="Settings" lead={`${family.name}. Change the email you use to sign in.`} />
        <section className="adm-card" aria-labelledby="acc-title">
          <h2 id="acc-title" className="adm-h2">Your email</h2>
          <ChangeEmailForm current={family.email} />
        </section>
      </main>
    </>
  );
}
