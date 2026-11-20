"use client";
import { PasswordFields } from "../admin/password-fields";
import { startTransition, useActionState } from "react";
import { familySignIn, registerFamily, type FamilyFormState } from "./actions";
import { SLink } from "../admin/ui";

function useForm(fn: (prev: FamilyFormState, fd: FormData) => Promise<FamilyFormState>) {
  const [state, action, pending] = useActionState(fn, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return { state, onSubmit, pending };
}

const invalid = (state: FamilyFormState, field: string) => (state?.field === field ? { "aria-invalid": true, "aria-describedby": "form-error" } : {});

function Status({ text, title }: { text: string; title: string }) {
  return (
    <div className="fam-status" role="status">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

export function FamilySignInForm({ next = "", notice }: { next?: string; notice?: string }) {
  const { state, onSubmit, pending } = useForm(familySignIn);
  return (
    <form onSubmit={onSubmit} className="adm-f">
      {notice && !state && <p className="adm-msg adm-msg--ok" role="status">{notice}</p>}
      {state?.error && <p className="adm-msg adm-msg--err" role="alert" id="form-error">{state.error}</p>}
      {state?.done === "status" && <Status title="You cannot sign in yet" text={state.message ?? ""} />}
      {next && <input type="hidden" name="next" value={next} />}
      <label>
        Email
        <input type="email" name="email" autoComplete="username" required autoFocus />
      </label>
      <label>
        Password
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
        <SLink href="/family/register">New family? Create an account</SLink>
        <SLink href="/family/forgot-password">Forgot your password?</SLink>
      </div>
    </form>
  );
}

export function RegisterForm() {
  const { state, onSubmit, pending } = useForm(registerFamily);
  if (state?.done === "pending") {
    return (
      <>
        <Status title="Account created: waiting for approval" text={state.message ?? ""} />
        <p className="adm-actions"><SLink href="/family">Go to family sign-in</SLink><a href="/">Back to the Parent Portal</a></p>
      </>
    );
  }
  return (
    <form onSubmit={onSubmit} className="adm-f" noValidate>
      {state?.error && <p className="adm-msg adm-msg--err" role="alert" id="form-error">{state.error}</p>}
      <label>
        Family name
        <span className="hint">How the school will recognise you, for example: The García family.</span>
        <input type="text" name="name" autoComplete="family-name" maxLength={100} required autoFocus {...invalid(state, "name")} />
      </label>
      <label>
        Email
        <input type="email" name="email" autoComplete="email" maxLength={200} required {...invalid(state, "email")} />
      </label>
      <PasswordFields min={10} hint="A short sentence is easy to remember." invalidPassword={invalid(state, "password")} invalidConfirm={invalid(state, "confirm")} />
      <label>
        School code
        <span className="hint">The school office gives this code to families.</span>
        <input type="text" name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20} required {...invalid(state, "code")} />
      </label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Creating the account…" : "Create account"}</button>
        <SLink href="/family">I already have an account</SLink>
      </div>
    </form>
  );
}
