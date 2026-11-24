import { redirect } from "next/navigation";
import { platformState } from "../../../lib/platform";
import { PlatformSolo } from "../chrome";
import { VerifyForm } from "../forms";

export const metadata = { title: "Two-step sign-in" };

export default async function TwoStep() {
  const { admin } = await platformState();
  if (!admin) redirect("/platform/sign-in");
  if (!admin.totpOn) redirect("/platform/two-step/setup");
  if (admin.verified) redirect("/platform");
  return (
    <>
      <PlatformSolo signedIn />
      <main id="main" className="adm-main">
        <div className="adm-card adm-card--narrow">
          <h1>Enter your code</h1>
          <p className="lead">Open your authenticator app and type the code for FAMITENLY ({admin.email}).</p>
          <VerifyForm />
        </div>
      </main>
    </>
  );
}
