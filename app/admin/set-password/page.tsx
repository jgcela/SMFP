import type { Metadata } from "next";
import { loadSchoolHeader } from "../school";
import { SetPasswordForm } from "../forms";

export const dynamic = "force-dynamic";
// The link carries a one-time token: never send it to other sites.
export const metadata: Metadata = { title: "Choose your password", referrer: "no-referrer" };

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [school, sp] = await Promise.all([loadSchoolHeader(), searchParams]);
  return (
    <>
      <header className="adm-top">
        <div className="in">
          {school.logoUrl && <img src={school.logoUrl} alt="" />}
          <div className="t">
            {school.name}
            <small>Staff</small>
          </div>
        </div>
      </header>
      <main className="adm-main">
        <div className="adm-card">
          <h1>Choose your password</h1>
          <p className="lead">This link works once. After saving, sign in with your email and this password.</p>
          <SetPasswordForm token={sp.token ?? ""} />
        </div>
      </main>
    </>
  );
}
