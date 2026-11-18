import type { Metadata } from "next";
import { AdminTop } from "../chrome";
import { SetPasswordForm } from "../forms";

export const dynamic = "force-dynamic";
// The link carries a one-time token: never send it to other sites.
export const metadata: Metadata = { title: "Choose your password", referrer: "no-referrer" };

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const sp = await searchParams;
  return (
    <>
      <AdminTop signedIn={false} />
      <main className="adm-main">
        <div className="adm-card adm-card--narrow">
          <h1>Choose your password</h1>
          <p className="lead">This link works once. After saving, sign in with your email and this password.</p>
          <SetPasswordForm token={sp.token ?? ""} />
        </div>
      </main>
    </>
  );
}
