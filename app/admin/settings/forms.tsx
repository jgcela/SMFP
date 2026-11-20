"use client";
import { startTransition, useActionState } from "react";
import type { AccountState } from "../../account/actions";
import { saveNotifyEmail } from "./actions";

export function NotifyEmailForm({ value }: { value: string }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(saveNotifyEmail, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return (
    <form onSubmit={onSubmit} className="adm-f" noValidate>
      {state?.error && <p className="adm-msg adm-msg--err" role="alert" id="notify-error">{state.error}</p>}
      {state?.ok && <p className="adm-msg adm-msg--ok" role="status">{state.ok}</p>}
      <label>
        Email for new families waiting for approval
        <span className="hint">We send a short email here each time a family creates an account. Leave it empty to send nothing.</span>
        <input type="email" name="notify_email" defaultValue={value} maxLength={200} autoComplete="off"
          {...(state?.field === "notify_email" ? { "aria-invalid": true, "aria-describedby": "notify-error" } : {})} />
      </label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--outline" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
