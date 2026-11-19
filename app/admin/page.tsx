import { db } from "../../lib/db";
import { currentStaff } from "../../lib/staff";
import { Icon } from "./icons";
import { AdminTop, PageHead } from "./chrome";
import { loadSchoolHeader } from "./school";
import { NoticeForm, SignInForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const [{ user, staff }, sp] = await Promise.all([currentStaff(), searchParams]);

  if (!user) {
    return (
      <>
        <AdminTop signedIn={false} />
        <main id="main" className="adm-main">
          <div className="adm-card adm-card--narrow">
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
        <AdminTop signedIn />
        <main id="main" className="adm-main">
          <div className="adm-card adm-card--narrow">
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

  const school = await loadSchoolHeader();
  return (
    <>
      <AdminTop signedIn section="notice" />
      <main id="main" className="adm-main">
        <PageHead
          title="Featured notice"
          lead={<>The bar at the top of the family portal. Signed in as {staff.email}.</>}
          actions={
            <a className="btn btn--outline" href="/" target="_blank" rel="noopener">
              <Icon name="external" />
              Open family portal<span className="sr-only"> (opens in a new tab)</span>
            </a>
          }
        />
        <NoticeForm initial={initial} preview={{ name: school.name, logoUrl: school.logoUrl }} />
      </main>
    </>
  );
}
