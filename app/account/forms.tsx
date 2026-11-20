"use client";
// Forms of step 9 (forgotten password, new password, email change), shared by
// the staff area and "My family".
import { startTransition, useActionState } from "react";
import { confirmEmailChange, requestEmailChange, requestPasswordReset, resetPassword, type AccountState } from "./actions";
import { PasswordFields } from "../admin/password-fields";

function useForm(fn: (prev: AccountState, fd: FormData) => Promise<AccountState>) {
  const [state, action, pending] = useActionState(fn, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return { state, onSubmit, pending };
}

function Message({ state }: { state: AccountState }) {
  if (state?.error) return <p className="adm-msg adm-msg--err" role="alert" id="form-error">{state.error}</p>;
  if (state?.ok) return <p className="adm-msg adm-msg--ok" role="status">{state.ok}</p>;
  return null;
}

const invalid = (state: AccountState, field: string) => (state?.field === field ? { "aria-invalid": true, "aria-describedby": "form-error" } : {});

export function ForgotPasswordForm({ back }: { back: string }) {
  const { state, onSubmit, pending } = useForm(requestPasswordReset);
  if (state?.ok) {
    return (
      <>
        <Message state={state} />
        <p className="adm-actions"><a href={back}>Back to sign-in</a></p>
      </>
    );
  }
  return (
    <form onSubmit={onSubmit} className="adm-f" noValidate>
      <Message state={state} />
      <label>
        Email of your account
        <input type="email" name="email" autoComplete="username" maxLength={200} required autoFocus {...invalid(state, "email")} />
      </label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Sending…" : "Send me a link"}</button>
        <a href={back}>Back to sign-in</a>
      </div>
    </form>
  );
}

export function NewPasswordForm({ token }: { token: string }) {
  const { state, onSubmit, pending } = useForm(resetPassword);
  return (
    <form onSubmit={onSubmit} className="adm-f">
      <Message state={state} />
      <input type="hidden" name="token" value={token} />
      <PasswordFields min={10} label="New password" hint="A short sentence is easy to remember." autoFocus
        invalidPassword={invalid(state, "password")} invalidConfirm={invalid(state, "confirm")} />
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : "Save new password"}</button>
      </div>
    </form>
  );
}

export function ConfirmEmailForm({ token, email, signIn }: { token: string; email: string; signIn: string }) {
  const { state, onSubmit, pending } = useForm(confirmEmailChange);
  if (state?.ok) {
    return (
      <>
        <Message state={state} />
        <p className="adm-actions"><a href={signIn}>Continue</a></p>
      </>
    );
  }
  return (
    <form onSubmit={onSubmit} className="adm-f">
      <Message state={state} />
      <input type="hidden" name="token" value={token} />
      <p>The new email of the account will be <strong>{email}</strong>.</p>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Confirming…" : "Confirm new email"}</button>
      </div>
    </form>
  );
}

export function ChangeEmailForm({ current }: { current: string }) {
  const { state, onSubmit, pending } = useForm(requestEmailChange);
  return (
    <form onSubmit={onSubmit} className="adm-f" noValidate>
      <p className="hint">Your email now: <strong>{current}</strong>. We will send a link to the new email; the change happens when you open it.</p>
      <Message state={state} />
      <label>
        New email
        <input type="email" name="email" autoComplete="email" maxLength={200} required {...invalid(state, "email")} />
      </label>
      <label>
        Your current password
        <span className="hint">To check that it is really you.</span>
        <input type="password" name="password" autoComplete="current-password" maxLength={200} required {...invalid(state, "password")} />
      </label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Sending…" : "Send confirmation link"}</button>
      </div>
    </form>
  );
}
