"use client";
import { startTransition, useActionState } from "react";
import type { AccountState } from "../../account/actions";
import { saveNotifyEmail, setSupportAccess } from "./actions";

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

export function SupportAccessForm({ until }: { until: string | null }) {
  const [state, action, pending] = useActionState<AccountState, FormData>(setSupportAccess, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.name === "hours") fd.set("hours", submitter.value);
    startTransition(() => action(fd));
  };
  return (
    <form onSubmit={onSubmit} className="adm-f">
      {state?.error && <p className="adm-msg adm-msg--err" role="alert">{state.error}</p>}
      {state?.ok && <p className="adm-msg adm-msg--ok" role="status">{state.ok}</p>}
      <p>{until ? <>FAMITENLY support can enter this panel until <strong>{until}</strong>.</> : "FAMITENLY support cannot enter this panel."} While they are in, the panel shows a &ldquo;Support mode&rdquo; strip and every change is recorded.</p>
      <label>
        Allow support for
        <select name="hours" defaultValue="4">
          <option value="1">1 hour</option>
          <option value="4">4 hours</option>
          <option value="24">24 hours</option>
          <option value="72">3 days</option>
        </select>
      </label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--outline" disabled={pending}>{until ? "Allow again from now" : "Allow support"}</button>
        {until && <button type="submit" name="hours" value="0" className="btn btn--outline" disabled={pending}>Turn off support access</button>}
      </div>
    </form>
  );
}
