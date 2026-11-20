import { db } from "../../../lib/db";
import { requirePlatformPage } from "../../../lib/platform";
import { PlatformHead, PlatformSide } from "../chrome";
import { NewBackupCodesForm } from "../forms";

export const metadata = { title: "Your account" };

export default async function Account() {
  const admin = await requirePlatformPage();
  const [r] = await db()<{ left: number }[]>`select coalesce(array_length(backup_codes, 1), 0) as left from platform_admins where user_id = ${admin.userId}`;
  return (
    <>
      <PlatformSide page="account" email={admin.email} />
      <main id="main" className="adm-main">
        <PlatformHead title="Your account" lead={<>Signed in as <strong>{admin.email}</strong>. Two-step sign-in is on.</>} />
        <section className="adm-card" aria-labelledby="bk">
          <h2 id="bk" className="adm-h2">Backup codes</h2>
          <NewBackupCodesForm left={r?.left ?? 0} />
        </section>
      </main>
    </>
  );
}
