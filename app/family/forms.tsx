"use client";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { familySignIn, registerFamily, type FamilyFormState } from "./actions";

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
        <Link href="/family/register">New family? Create an account</Link>
        <Link href="/family/forgot-password">Forgot your password?</Link>
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
        <p className="adm-actions"><Link href="/family">Go to family sign-in</Link><a href="/">Back to the Parent Portal</a></p>
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
      <label>
        Password
        <span className="hint">At least 10 characters. A short sentence is easy to remember.</span>
        <input type="password" name="password" autoComplete="new-password" minLength={10} maxLength={128} required {...invalid(state, "password")} />
      </label>
      <label>
        Repeat the password
        <input type="password" name="confirm" autoComplete="new-password" minLength={10} maxLength={128} required {...invalid(state, "confirm")} />
      </label>
      <label>
        School code
        <span className="hint">The school office gives this code to families.</span>
        <input type="text" name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20} required {...invalid(state, "code")} />
      </label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Creating the account…" : "Create account"}</button>
        <Link href="/family">I already have an account</Link>
      </div>
    </form>
  );
}
