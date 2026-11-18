// Family sign-in, and what a signed-in family sees (for now only a welcome:
// "My family" comes in a later step). The public portal does not need this.
import Link from "next/link";
import { familyOfUser } from "../../lib/family";
import { currentStaff } from "../../lib/staff";
import { AdminTop } from "../admin/chrome";
import { FamilySignInForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function FamilyPage() {
  const { user, staff } = await currentStaff();
  const family = user ? await familyOfUser(user.id) : null;

  if (user && family?.status === "approved") {
    return (
      <>
        <AdminTop signedIn area="family" />
        <main className="adm-main">
          <div className="adm-card adm-card--narrow">
            <h1>Welcome, {family.name}</h1>
            <p className="lead">You are signed in to the Parent Portal as {family.email}.</p>
            <p className="adm-actions"><a className="btn btn--primary" href="/">Go to the Parent Portal</a></p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <AdminTop signedIn={false} area="family" />
      <main className="adm-main">
        <div className="adm-card adm-card--narrow">
          <h1>Family sign-in</h1>
          {user && staff && <p className="adm-msg adm-msg--ok">You are signed in as school staff. <Link href="/admin">Go to the staff area</Link>.</p>}
          <p className="lead">For families of the school. The Parent Portal itself is open to everyone without signing in.</p>
          <FamilySignInForm />
        </div>
      </main>
    </>
  );
}
