"use client";
import { startTransition, useActionState, useState } from "react";
import { saveNotice, setPassword, signIn, type FormState } from "./actions";

// Submitting through onSubmit (not the form "action" prop) keeps what the
// person typed when the server answers with an error: React resets forms
// submitted through "action".
function useForm(fn: (prev: FormState, fd: FormData) => Promise<FormState>) {
  const [state, action, pending] = useActionState(fn, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return { state, onSubmit, pending };
}

function Submit({ children, busy, pending }: { children: React.ReactNode; busy: string; pending: boolean }) {
  return (
    <button type="submit" className="btn btn--primary" disabled={pending}>
      {pending ? busy : children}
    </button>
  );
}

function Message({ state }: { state: FormState }) {
  if (state?.error) return <p className="adm-msg adm-msg--err" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="adm-msg adm-msg--ok" role="status">{state.ok}</p>;
  return null;
}

export function SignInForm({ notice }: { notice?: string }) {
  const { state, onSubmit, pending } = useForm(signIn);
  return (
    <form onSubmit={onSubmit} className="adm-f">
      {notice && !state && <p className="adm-msg adm-msg--ok" role="status">{notice}</p>}
      <Message state={state} />
      <label>
        Email
        <input type="email" name="email" autoComplete="username" required autoFocus />
      </label>
      <label>
        Password
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      <div className="adm-actions">
        <Submit pending={pending} busy="Signing in…">Sign in</Submit>
      </div>
    </form>
  );
}

export function SetPasswordForm({ token }: { token: string }) {
  const { state, onSubmit, pending } = useForm(setPassword);
  return (
    <form onSubmit={onSubmit} className="adm-f">
      <Message state={state} />
      <input type="hidden" name="token" value={token} />
      <label>
        New password
        <span className="hint">At least 10 characters. A short sentence is easy to remember.</span>
        <input type="password" name="password" autoComplete="new-password" minLength={10} maxLength={128} required autoFocus />
      </label>
      <label>
        Repeat the password
        <input type="password" name="confirm" autoComplete="new-password" minLength={10} maxLength={128} required />
      </label>
      <div className="adm-actions">
        <Submit pending={pending} busy="Saving…">Save password</Submit>
      </div>
    </form>
  );
}

export type NoticeValues = { message: string; linkLabel: string; linkHref: string; show: boolean };

export function NoticeForm({ initial }: { initial: NoticeValues }) {
  const { state, onSubmit, pending } = useForm(saveNotice);
  const [show, setShow] = useState(initial.show);
  return (
    <form onSubmit={onSubmit} className="adm-f">
      <Message state={state} />
      <label>
        Notice text
        <span className="hint">Shown in the yellow bar at the top of the portal. Up to 300 characters.</span>
        <textarea name="message" maxLength={300} defaultValue={initial.message} />
      </label>
      <fieldset>
        <legend>Link (optional)</legend>
        <label>
          Link text
          <input type="text" name="link_label" maxLength={60} defaultValue={initial.linkLabel} placeholder="Read more" />
        </label>
        <label>
          Link address
          <input type="text" name="link_href" inputMode="url" maxLength={500} defaultValue={initial.linkHref} placeholder="https://" />
        </label>
      </fieldset>
      <label className="adm-switch">
        <input type="checkbox" name="show" role="switch" checked={show} onChange={(e) => setShow(e.target.checked)} />
        <span aria-hidden="true" />
        {show ? "Shown on the portal" : "Hidden from the portal"}
      </label>
      <div className="adm-actions">
        <Submit pending={pending} busy="Saving…">Save</Submit>
        <a href="/" target="_blank" rel="noopener">Open the portal</a>
      </div>
    </form>
  );
}
