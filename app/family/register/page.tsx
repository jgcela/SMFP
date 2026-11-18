import Link from "next/link";
import { AdminTop } from "../../admin/chrome";
import { RegisterForm } from "../forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create a family account" };

export default function RegisterPage() {
  return (
    <>
      <AdminTop signedIn={false} area="family" />
      <main className="adm-main">
        <div className="adm-card adm-card--narrow">
          <p className="adm-back"><Link href="/family">← Family sign-in</Link></p>
          <h1>Create a family account</h1>
          <p className="lead">You need the school code. The school checks every new account before it can be used.</p>
          <RegisterForm />
        </div>
      </main>
    </>
  );
}
