import { db } from "../../lib/db";
import { currentStaff } from "../../lib/staff";
import { loadSchoolHeader } from "./school";
import { signOut } from "./actions";
import { NoticeForm, SignInForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const [{ user, staff }, school, sp] = await Promise.all([currentStaff(), loadSchoolHeader(), searchParams]);

  const top = (
    <header className="adm-top">
      <div className="in">
        {school.logoUrl && <img src={school.logoUrl} alt="" />}
        <div className="t">
          {school.name}
          <small>Staff</small>
        </div>
        {user && (
          <form action={signOut}>
            <button type="submit">Sign out</button>
          </form>
        )}
      </div>
    </header>
  );

  if (!user) {
    return (
      <>
        {top}
        <main className="adm-main">
          <div className="adm-card">
            <h1>Staff sign-in</h1>
            <p className="lead">For school staff only. Families do not need to sign in.</p>
            <SignInForm notice={sp.password === "set" ? "Your password is saved. Sign in with it." : undefined} />
          </div>
        </main>
      </>
    );
  }

  if (!staff) {
    return (
      <>
        {top}
        <main className="adm-main">
          <div className="adm-card">
            <h1>No access</h1>
            <p className="lead">This account cannot edit this school&apos;s portal.</p>
          </div>
        </main>
      </>
    );
  }

  const [n] = await db()<{ message: string; link_label: string; link_href: string; is_active: boolean }[]>`
    select message, link_label, link_href, is_active from notices
    where school_id = ${staff.schoolId} order by created_at desc, id desc limit 1`;
  const initial = n
    ? { message: n.message, linkLabel: n.link_href ? n.link_label : "", linkHref: n.link_href, show: n.is_active }
    : { message: "", linkLabel: "", linkHref: "", show: false };

  return (
    <>
      {top}
      <main className="adm-main">
        <div className="adm-card">
          <h1>Featured notice</h1>
          <p className="lead">Signed in as {staff.email}.</p>
          <NoticeForm initial={initial} />
        </div>
      </main>
    </>
  );
}
