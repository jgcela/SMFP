import { redirect } from "next/navigation";
import { platformState } from "../../../lib/platform";
import { PlatformSolo } from "../chrome";
import { SignInForm } from "../forms";

export const metadata = { title: "Sign in" };

export default async function PlatformSignIn() {
  const { admin } = await platformState();
  if (admin?.verified) redirect("/platform");
  if (admin) redirect(admin.totpOn ? "/platform/two-step" : "/platform/two-step/setup");
  return (
    <>
      <PlatformSolo signedIn={false} />
      <main id="main" className="adm-main">
        <div className="adm-card adm-card--narrow">
          <h1>FAMITENLY sign-in</h1>
          <p className="lead">For FAMITENLY Super Admins only. School staff sign in from their school&rsquo;s portal.</p>
          <SignInForm />
        </div>
      </main>
    </>
  );
}
