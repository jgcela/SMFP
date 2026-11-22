"use client";
import { startTransition, useActionState } from "react";
import { PasswordFields } from "../../admin/password-fields";
import { acceptExisting, acceptNew, type InviteState } from "./actions";

function useForm(fn: (prev: InviteState, fd: FormData) => Promise<InviteState>) {
  const [state, action, pending] = useActionState(fn, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return { state, onSubmit, pending };
}
const invalid = (state: InviteState, field: string) => (state?.field === field ? { "aria-invalid": true, "aria-describedby": "form-error" } : {});
const Err = ({ state }: { state: InviteState }) => (state?.error ? <p className="adm-msg adm-msg--err" role="alert" id="form-error">{state.error}</p> : null);

export function NewAccountForm({ token, email }: { token: string; email: string }) {
  const { state, onSubmit, pending } = useForm(acceptNew);
  return (
    <form onSubmit={onSubmit} className="adm-f">
      <Err state={state} />
      <input type="hidden" name="token" value={token} />
      <label>Email<input type="email" value={email} readOnly autoComplete="username" /></label>
      <label>Family name<span className="hint">For example: The García family</span>
        <input type="text" name="name" maxLength={100} required autoComplete="family-name" autoFocus {...invalid(state, "name")} /></label>
      <PasswordFields min={10} label="Password" hint="A short sentence is easy to remember."
        invalidPassword={invalid(state, "password")} invalidConfirm={invalid(state, "confirm")} />
      <div className="adm-actions"><button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Creating…" : "Create my account"}</button></div>
    </form>
  );
}

export function ExistingAccountForm({ token, email }: { token: string; email: string }) {
  const { state, onSubmit, pending } = useForm(acceptExisting);
  if (state?.message) return <p className="adm-msg adm-msg--ok" role="status">{state.message}</p>;
  return (
    <form onSubmit={onSubmit} className="adm-f">
      <Err state={state} />
      <input type="hidden" name="token" value={token} />
      <label>Email<input type="email" value={email} readOnly autoComplete="username" /></label>
      <label>Password of your account
        <input type="password" name="password" autoComplete="current-password" maxLength={200} required autoFocus {...invalid(state, "password")} /></label>
      <div className="adm-actions"><button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Confirming…" : "Confirm access"}</button></div>
    </form>
  );
}
