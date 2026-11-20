"use client";
// Forms of FAMITENLY's panel. Submitting through onSubmit keeps what the person
// typed when the server answers with an error.
import { startTransition, useActionState, useState } from "react";
import {
  confirmTwoStep, createFirstAdmin, createSchool, newBackupCodesAction, platformSignIn, platformVerify, resendInvite,
  setPlanAndModules, setSchoolStatus, type PfState,
} from "./actions";
import { PasswordFields } from "../admin/password-fields";

type Fn = (prev: PfState, fd: FormData) => Promise<PfState>;
function useForm(fn: Fn) {
  const [state, action, pending] = useActionState(fn, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return { state, onSubmit, pending };
}

function Message({ state, id }: { state: PfState; id?: string }) {
  if (state?.error)
    return (
      <div className="adm-msg adm-msg--err" role="alert" id={id}>
        {state.error}
        {state.link && <p className="pf-link"><code>{state.link}</code></p>}
      </div>
    );
  if (state?.ok) return <p className="adm-msg adm-msg--ok" role="status">{state.ok}</p>;
  return null;
}

const invalid = (state: PfState, field: string) => (state?.field === field ? { "aria-invalid": true, "aria-describedby": "pf-err" } : {});

function Codes({ codes }: { codes: string[] }) {
  return (
    <>
      <p>Save these backup codes somewhere safe (a password manager, or printed). Each one works once, if you lose your phone. They are shown only now.</p>
      <ul className="pf-codes" aria-label="Backup codes">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
    </>
  );
}

export function SignInForm() {
  const { state, onSubmit, pending } = useForm(platformSignIn);
  return (
    <form onSubmit={onSubmit} className="adm-f">
      <Message state={state} />
      <label>Email<input type="email" name="email" autoComplete="username" required autoFocus /></label>
      <label>Password<input type="password" name="password" autoComplete="current-password" required /></label>
      <div className="adm-actions"><button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Signing in…" : "Continue"}</button></div>
    </form>
  );
}

export function VerifyForm() {
  const { state, onSubmit, pending } = useForm(platformVerify);
  return (
    <form onSubmit={onSubmit} className="adm-f">
      <Message state={state} />
      <label>
        Code
        <span className="hint">The 6-digit code in your authenticator app, or one of your backup codes.</span>
        <input type="text" name="code" inputMode="text" autoComplete="one-time-code" maxLength={20} required autoFocus spellCheck={false} />
      </label>
      <div className="adm-actions"><button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Checking…" : "Sign in"}</button></div>
    </form>
  );
}

export function SetupTwoStepForm() {
  const { state, onSubmit, pending } = useForm(confirmTwoStep);
  if (state?.codes)
    return (
      <>
        <p className="adm-msg adm-msg--ok" role="status">{state.ok}</p>
        <Codes codes={state.codes} />
        <p className="adm-actions"><a className="btn btn--primary" href="/platform">I saved them. Continue</a></p>
      </>
    );
  return (
    <form onSubmit={onSubmit} className="adm-f">
      <Message state={state} />
      <label>
        Code from the app
        <span className="hint">After scanning, type the 6-digit code the app shows.</span>
        <input type="text" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required spellCheck={false} />
      </label>
      <div className="adm-actions"><button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Checking…" : "Turn on two-step sign-in"}</button></div>
    </form>
  );
}

export function NewBackupCodesForm({ left }: { left: number }) {
  const { state, onSubmit, pending } = useForm(newBackupCodesAction);
  return (
    <form onSubmit={onSubmit} className="adm-f">
      <p>You have <strong>{state?.codes ? 10 : left}</strong> unused backup codes.</p>
      {state?.codes ? <><p className="adm-msg adm-msg--ok" role="status">{state.ok}</p><Codes codes={state.codes} /></> : <Message state={state} />}
      <label>
        Code from your authenticator app
        <input type="text" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} required spellCheck={false} />
      </label>
      <div className="adm-actions"><button type="submit" className="btn btn--outline" disabled={pending}>{pending ? "Making…" : "Make 10 new backup codes"}</button></div>
    </form>
  );
}

export function FirstAdminForm() {
  const { state, onSubmit, pending } = useForm(createFirstAdmin);
  return (
    <form onSubmit={onSubmit} className="adm-f" noValidate>
      <Message state={state} id="pf-err" />
      <label>Set-up code<span className="hint">The value of PLATFORM_SETUP_CODE in Vercel.</span>
        <input type="password" name="setup_code" autoComplete="off" required {...invalid(state, "setup_code")} /></label>
      <label>Your name<input type="text" name="name" autoComplete="name" maxLength={100} required {...invalid(state, "name")} /></label>
      <label>Your email<input type="email" name="email" autoComplete="username" required {...invalid(state, "email")} /></label>
      <PasswordFields min={12} confirmLabel="Password again" invalidPassword={invalid(state, "password")} invalidConfirm={invalid(state, "confirm")} />
      <div className="adm-actions"><button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Creating…" : "Create Super Admin"}</button></div>
    </form>
  );
}

export type PlanOption = { id: string; name: string; price: string; summary: string };

export function NewSchoolForm({ plans, timezones }: { plans: PlanOption[]; timezones: string[] }) {
  const { state, onSubmit, pending } = useForm(createSchool);
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);
  const suggest = (name: string) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
  return (
    <form onSubmit={onSubmit} className="adm-f" encType="multipart/form-data" noValidate>
      <Message state={state} id="pf-err" />
      <label>School name<input type="text" name="name" maxLength={120} required onChange={(e) => { if (!touched) setSlug(suggest(e.target.value)); }} {...invalid(state, "name")} /></label>
      <label>
        Code for the address
        <span className="hint">Lowercase letters, numbers and dashes. The portal will be at <strong>/s/{slug || "code"}/</strong>. It cannot be changed later.</span>
        <input type="text" name="slug" value={slug} maxLength={32} required spellCheck={false} autoCapitalize="none"
          onChange={(e) => { setTouched(true); setSlug(e.target.value.toLowerCase()); }} {...invalid(state, "slug")} />
      </label>
      <label>
        Time zone
        <select name="timezone" defaultValue="America/Denver" required {...invalid(state, "timezone")}>
          {timezones.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
      </label>
      <label>
        Logo
        <span className="hint">Optional. PNG, JPG or WebP, up to 1 MB. Shown in the portal header, the panels and the emails.</span>
        <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" {...invalid(state, "logo")} />
      </label>
      <div className="pf-colors">
        <label>Main colour<span className="hint">Header, titles and links.</span><input type="color" name="primary" defaultValue="#1F3A68" {...invalid(state, "primary")} /></label>
        <label>Accent colour<span className="hint">Main buttons.</span><input type="color" name="accent" defaultValue="#F2B233" /></label>
      </div>
      <fieldset className="pf-plans">
        <legend>Plan</legend>
        {plans.map((p, i) => (
          <label key={p.id}>
            <input type="radio" name="plan" value={p.id} defaultChecked={i === 0} />
            <strong>{p.name}</strong>
            <span className="price">{p.price}</span>
            <span>{p.summary}</span>
          </label>
        ))}
      </fieldset>
      <label>
        State
        <select name="status" defaultValue="trial">
          <option value="trial">Trial</option>
          <option value="active">Active</option>
        </select>
      </label>
      <label>
        First administrator&rsquo;s email
        <span className="hint">They get an email invitation to choose their password (the link works for 7 days).</span>
        <input type="email" name="admin_email" autoComplete="off" required {...invalid(state, "admin_email")} />
      </label>
      <div className="adm-actions"><button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Creating…" : "Create school"}</button></div>
    </form>
  );
}

export type ModuleOption = { id: string; name: string; lead: string; available: boolean; plans: string[] };

export function PlanModulesForm({ schoolId, plan, modules, plans, options }: { schoolId: number; plan: string; modules: string[]; plans: PlanOption[]; options: ModuleOption[] }) {
  const { state, onSubmit, pending } = useForm(setPlanAndModules);
  const [current, setCurrent] = useState(plan);
  const needs = (m: ModuleOption) => plans.filter((p) => m.plans.includes(p.id)).map((p) => p.name).join(" or ");
  return (
    <form onSubmit={onSubmit} className="adm-f">
      <Message state={state} />
      <input type="hidden" name="school_id" value={schoolId} />
      <fieldset className="pf-plans">
        <legend>Plan</legend>
        {plans.map((p) => (
          <label key={p.id}>
            <input type="radio" name="plan" value={p.id} checked={current === p.id} onChange={() => setCurrent(p.id)} />
            <strong>{p.name}</strong>
            <span className="price">{p.price}</span>
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Modules</legend>
        <p className="hint">The home page, notice, calendar, documents, links, contact and pages are always on. The plan decides which of these the school can have.</p>
        <ul className="pf-mods">
          {options.map((m) => {
            const allowed = m.available && m.plans.includes(current);
            return (
              <li key={m.id}>
                <input type="checkbox" name="modules" value={m.id} id={`mod-${m.id}`} defaultChecked={modules.includes(m.id)} disabled={!allowed} />
                <span className="what">
                  <label htmlFor={`mod-${m.id}`}><strong>{m.name}</strong></label>
                  <span className="note">{!m.available ? `Not available yet (${needs(m)})` : !allowed ? `Needs the ${needs(m)} plan` : m.lead}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div className="adm-actions"><button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : "Save plan and modules"}</button></div>
    </form>
  );
}

export function StatusForm({ schoolId, status, name }: { schoolId: number; status: string; name: string }) {
  const { state, onSubmit, pending } = useForm(setSchoolStatus);
  const [ask, setAsk] = useState(false);
  if (status === "suspended")
    return (
      <form onSubmit={onSubmit} className="adm-f">
        <Message state={state} />
        <input type="hidden" name="school_id" value={schoolId} />
        <p>The portal shows a notice and nobody of the school can sign in.</p>
        <label>Reactivate as
          <select name="status" defaultValue="active"><option value="active">Active</option><option value="trial">Trial</option></select>
        </label>
        <div className="adm-actions"><button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : "Reactivate"}</button></div>
      </form>
    );
  return (
    <div className="adm-f">
      <Message state={state} />
      <form onSubmit={onSubmit} className="adm-actions">
        <input type="hidden" name="school_id" value={schoolId} />
        <input type="hidden" name="status" value={status === "active" ? "trial" : "active"} />
        <button type="submit" className="btn btn--outline" disabled={pending}>{status === "active" ? "Change to Trial" : "Change to Active"}</button>
      </form>
      {ask ? (
        <form onSubmit={(e) => { setAsk(false); onSubmit(e); }} className="adm-actions" role="group" aria-label={`Suspend ${name}?`}>
          <input type="hidden" name="school_id" value={schoolId} />
          <input type="hidden" name="status" value="suspended" />
          <span>Suspend {name}? Its portal will show a notice and nobody of the school can sign in.</span>
          <button type="submit" className="btn btn--primary" autoFocus disabled={pending}>Yes, suspend</button>
          <button type="button" className="btn btn--outline" onClick={() => setAsk(false)}>Cancel</button>
        </form>
      ) : (
        <p className="adm-actions"><button type="button" className="btn btn--outline" onClick={() => setAsk(true)}>Suspend school</button></p>
      )}
    </div>
  );
}

export function InviteForm({ schoolId }: { schoolId: number }) {
  const { state, onSubmit, pending } = useForm(resendInvite);
  return (
    <form onSubmit={onSubmit} className="adm-f">
      <Message state={state} />
      <input type="hidden" name="school_id" value={schoolId} />
      <label>Administrator&rsquo;s email<span className="hint">Adds them as an administrator (if they are not one yet) and emails an invitation.</span>
        <input type="email" name="email" autoComplete="off" required /></label>
      <div className="adm-actions"><button type="submit" className="btn btn--outline" disabled={pending}>{pending ? "Sending…" : "Send invitation"}</button></div>
    </form>
  );
}
