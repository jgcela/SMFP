// Pages of step 9, shared by the staff area (/admin/...) and "My family" (/family/...).
import { db } from "../../lib/db";
import { peekLink } from "../../lib/email-links";
import { schoolSlug } from "../../lib/portal";
import { AdminTop } from "../admin/chrome";
import { ConfirmEmailForm, ForgotPasswordForm, NewPasswordForm } from "./forms";

type Kind = "staff" | "family";
const home = (k: Kind) => (k === "staff" ? "/admin" : "/family");

function Frame({ kind, title, lead, children }: { kind: Kind; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <>
      <AdminTop signedIn={false} area={kind} />
      <main id="main" className="adm-main">
        <div className="adm-card adm-card--narrow">
          <h1>{title}</h1>
          {lead && <p className="lead">{lead}</p>}
          {children}
        </div>
      </main>
    </>
  );
}

async function schoolId() {
  const [s] = await db()<{ id: number }[]>`select id from schools where slug = ${schoolSlug()}`;
  return s?.id ?? 0;
}

function Expired({ kind, again }: { kind: Kind; again: string }) {
  return (
    <>
      <p className="adm-msg adm-msg--err" role="alert">This link has already been used or has expired. Links work once, for 1 hour.</p>
      <p className="adm-actions"><a className="btn btn--primary" href={again}>Ask for a new link</a><a href={home(kind)}>Back to sign-in</a></p>
    </>
  );
}

export function ForgotPasswordPage({ kind }: { kind: Kind }) {
  return (
    <Frame kind={kind} title="Forgot your password?" lead="Write the email of your account. We will send you a link to choose a new password.">
      <ForgotPasswordForm back={home(kind)} />
    </Frame>
  );
}

export async function ResetPasswordPage({ kind, token }: { kind: Kind; token: string }) {
  const ok = await peekLink(token, "reset_password", await schoolId());
  return (
    <Frame kind={kind} title="Choose a new password" lead={ok ? "After saving, sign in with your email and the new password." : undefined}>
      {ok ? <NewPasswordForm token={token} /> : <Expired kind={kind} again={`${home(kind)}/forgot-password`} />}
    </Frame>
  );
}

export async function ConfirmEmailPage({ kind, token }: { kind: Kind; token: string }) {
  const link = await peekLink(token, "change_email", await schoolId());
  return (
    <Frame kind={kind} title="Confirm your new email">
      {link?.new_email ? (
        <ConfirmEmailForm token={token} email={link.new_email} signIn={home(kind)} />
      ) : (
        <Expired kind={kind} again={`${home(kind)}/settings`} />
      )}
    </Frame>
  );
}
