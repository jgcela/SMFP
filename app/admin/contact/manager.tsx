"use client";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { checkEmail, checkPhone } from "../../../lib/contact";
import { deletePerson, movePerson, saveContact, savePerson, type ContactState } from "./actions";
import { Head } from "../ui";

export type ContactDetails = { phone: string; email: string; address: string; officeHours: string };
export type Person = { id: number; name: string; role: string; email: string };
type Msg = { text: string; err?: boolean } | null;

// A text field that warns as soon as the person leaves it, and before saving.
function Checked({ name, label, hint, value, onChange, check, warning, setWarning, ...rest }: {
  name: string; label: string; hint?: string; value: string; onChange: (v: string) => void;
  check: (v: string) => string | null; warning: string | null; setWarning: (w: string | null) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label>
      {label}
      {hint && <span className="hint">{hint}</span>}
      <input name={name} value={value} {...rest} aria-invalid={!!warning} aria-describedby={warning ? `${name}-warning` : undefined}
        onChange={(e) => { onChange(e.target.value); if (warning) setWarning(check(e.target.value)); }}
        onBlur={() => value.trim() && setWarning(check(value))} />
      {warning && <span id={`${name}-warning`} className="adm-msg adm-msg--err" role="alert">{warning}</span>}
    </label>
  );
}

function DetailsForm({ details, report }: { details: ContactDetails; report: (r: ContactState) => void }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(saveContact, undefined);
  const [phone, setPhone] = useState(details.phone);
  const [email, setEmail] = useState(details.email);
  const [phoneWarn, setPhoneWarn] = useState<string | null>(null);
  const [emailWarn, setEmailWarn] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (state) report(state); }, [state]); // only when a new result arrives

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const p = checkPhone(phone), m = checkEmail(email);
    setPhoneWarn(p); setEmailWarn(m);
    if (p || m) { ref.current?.querySelector<HTMLInputElement>(`input[name=${p ? "phone" : "email"}]`)?.focus(); return; }
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return (
    <form ref={ref} className="adm-f" onSubmit={submit} noValidate>
      <Checked name="phone" label="Phone" hint="On phones, tapping it starts the call." type="tel" inputMode="tel" maxLength={40} required
        value={phone} onChange={setPhone} check={checkPhone} warning={phoneWarn} setWarning={setPhoneWarn} />
      <Checked name="email" label="Email" hint="On phones, tapping it opens a new message." type="email" inputMode="email" maxLength={120} required
        value={email} onChange={setEmail} check={(v) => checkEmail(v)} warning={emailWarn} setWarning={setEmailWarn} />
      <label>
        Address (optional)
        <span className="hint">Street, city, state and ZIP code. Tapping it opens the map.</span>
        <input type="text" name="address" maxLength={200} defaultValue={details.address} autoComplete="off" />
      </label>
      <label>
        Office hours
        <span className="hint">For example “Monday–Friday, 7:30 a.m.–4:00 p.m.”</span>
        <input type="text" name="office_hours" maxLength={120} defaultValue={details.officeHours} />
      </label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : "Save contact details"}</button>
      </div>
    </form>
  );
}

function PersonForm({ person, onDone }: { person: Person | null; onDone: (msg: string) => void }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(savePerson, undefined);
  const [email, setEmail] = useState(person?.email ?? "");
  const [warn, setWarn] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: "nearest" }); ref.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus(); }, []);
  useEffect(() => { if (state?.ok) onDone(state.ok); }, [state, onDone]);
  const check = (v: string) => checkEmail(v, false);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const m = check(email);
    setWarn(m);
    if (m) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return (
    <form ref={ref} className="adm-f adm-panel" onSubmit={submit} noValidate>
      <h2>{person ? "Edit contact person" : "New contact person"}</h2>
      {state?.error && <p className="adm-msg adm-msg--err" role="alert">{state.error}</p>}
      {person && <input type="hidden" name="id" value={person.id} />}
      <label>
        Name
        <input type="text" name="name" maxLength={80} required defaultValue={person?.name ?? ""} />
      </label>
      <label>
        Role (optional)
        <span className="hint">For example “Principal” or “Admissions”.</span>
        <input type="text" name="role" maxLength={80} defaultValue={person?.role ?? ""} />
      </label>
      <Checked name="email" label="Email (optional)" type="email" inputMode="email" maxLength={120}
        value={email} onChange={setEmail} check={check} warning={warn} setWarning={setWarn} />
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" className="btn btn--outline" onClick={() => onDone("")}>Cancel</button>
      </div>
    </form>
  );
}

function Confirm({ onYes, onNo }: { onYes: () => Promise<void>; onNo: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <span className="confirm" role="group" aria-label="Delete this person?">
      <span>Delete this person?</span>
      <button type="button" className="danger" autoFocus disabled={busy} onClick={async () => { setBusy(true); await onYes(); setBusy(false); }}>
        {busy ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" onClick={onNo} disabled={busy}>Cancel</button>
    </span>
  );
}

export function ContactManager({ details, people }: { details: ContactDetails; people: Person[] }) {
  const [editing, setEditing] = useState<{ person: Person | null } | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const router = useRouter();
  const report = (r: ContactState) => {
    if (r?.error) setMsg({ text: r.error, err: true });
    else if (r?.ok) { setMsg({ text: r.ok }); router.refresh(); }
  };
  const done = (text: string) => { setEditing(null); if (text) { setMsg({ text }); router.refresh(); } };

  return (
    <>
      <Head title="Contact" lead={<>Shown in “Need the front office?” and in “We’re here for your family.” on the portal. One change updates both.</>} />
      <div className="adm-card">
      {msg && <p className={`adm-msg ${msg.err ? "adm-msg--err" : "adm-msg--ok"}`} role="status">{msg.text}</p>}
      <DetailsForm details={details} report={report} />

      <section className="adm-cat" aria-labelledby="people-title">
        <div className="adm-cat-top">
          <div>
            <h2 id="people-title">Contact people <span className="count">{people.length}</span></h2>
            <p className="note">Optional. Shown in “We’re here for your family.”, in this order.</p>
          </div>
          <div className="act">
            <button type="button" onClick={() => { setMsg(null); setEditing({ person: null }); }}>Add person</button>
          </div>
        </div>
        {editing && <PersonForm key={editing.person?.id ?? "new"} person={editing.person} onDone={done} />}
        {people.length ? (
          <ul className="adm-list">
            {people.map((p, i) => (
              <li key={p.id} className="adm-doc">
                <div className="what">
                  <strong>{p.name}</strong>
                  <span className="note adm-href">{[p.role, p.email].filter(Boolean).join(" · ")}</span>
                </div>
                <div className="act">
                  {confirm === p.id ? (
                    <Confirm onNo={() => setConfirm(null)} onYes={async () => { const r = await deletePerson(p.id); setConfirm(null); report(r); }} />
                  ) : (
                    <>
                      <button type="button" onClick={async () => report(await movePerson(p.id, -1))} disabled={i === 0} aria-label={`Move ${p.name} up`}>↑</button>
                      <button type="button" onClick={async () => report(await movePerson(p.id, 1))} disabled={i === people.length - 1} aria-label={`Move ${p.name} down`}>↓</button>
                      <button type="button" onClick={() => { setMsg(null); setEditing({ person: p }); }}>Edit</button>
                      <button type="button" onClick={() => setConfirm(p.id)}>Delete</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="adm-empty">No contact people. The portal only shows the office details.</p>
        )}
      </section>
      </div>
    </>
  );
}
