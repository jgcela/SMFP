import { db } from "../../../lib/db";
import { PlatformSolo } from "../chrome";
import { FirstAdminForm } from "../forms";

export const metadata = { title: "First Super Admin" };

// Creates the first Super Admin. Works only while there is none, and only with
// the set-up code in the server settings (PLATFORM_SETUP_CODE).
export default async function PlatformSetup() {
  const [{ n }] = await db()<{ n: number }[]>`select count(*)::int as n from platform_admins`;
  const configured = (process.env.PLATFORM_SETUP_CODE ?? "").length >= 12;
  return (
    <>
      <PlatformSolo signedIn={false} />
      <main id="main" className="adm-main">
        <div className="adm-card adm-card--narrow">
          <h1>Create the first Super Admin</h1>
          {n > 0 ? (
            <p className="lead">FAMITENLY already has a Super Admin. <a href="/platform/sign-in">Sign in</a>.</p>
          ) : !configured ? (
            <p className="lead">This page is turned off: the set-up code (PLATFORM_SETUP_CODE, at least 12 characters) is not in the server settings yet.</p>
          ) : (
            <>
              <p className="lead">This works once. Right after, you will turn on two-step sign-in with an authenticator app.</p>
              <FirstAdminForm />
            </>
          )}
        </div>
      </main>
    </>
  );
}
