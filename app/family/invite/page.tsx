// The link of a FACTS invitation (lib/facts-accounts.ts): create an account, or
// confirm an existing one with its password. The link works once, for 7 days.
import type { Metadata } from "next";
import { db } from "../../../lib/db";
import type { Db } from "../../../lib/facts-access";
import { peekInvitation } from "../../../lib/facts-accounts";
import { schoolSlug } from "../../../lib/portal";
import { AdminTop } from "../../admin/chrome";
import { ExistingAccountForm, NewAccountForm } from "./forms";

export const dynamic = "force-dynamic";
// The link carries a one-time token: never send it to other sites.
export const metadata: Metadata = { title: "Your family account", referrer: "no-referrer" };

export default async function InvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = String((await searchParams).token ?? "");
  const [s] = await db()<{ id: number; name: string }[]>`select id, name from schools where slug = ${await schoolSlug()} and status <> 'suspended'`;
  const open = s ? await peekInvitation(db() as unknown as Db, s.id, token) : null;
  return (
    <>
      <AdminTop signedIn={false} area="family" />
      <main id="main" className="adm-main">
        <div className="adm-card adm-card--narrow">
          {!open ? (
            <>
              <h1>This link does not work</h1>
              <p className="adm-msg adm-msg--err" role="alert">It has already been used, has expired (links work for 7 days) or was replaced by a newer one.</p>
              <p>Ask the school office to send you a new invitation.</p>
            </>
          ) : open.accountExists ? (
            <>
              <h1>Confirm access to your children</h1>
              <p className="lead">{s!.name} wants to link your account to your children&rsquo;s records. Enter the password of your account to confirm.</p>
              <ExistingAccountForm token={token} email={open.email} />
            </>
          ) : (
            <>
              <h1>Create your family account</h1>
              <p className="lead">{s!.name} invited you to its family portal. Choose your password to create your account.</p>
              <NewAccountForm token={token} email={open.email} />
            </>
          )}
        </div>
      </main>
    </>
  );
}
