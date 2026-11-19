"use client";
// "My family": what an approved family sees after signing in.
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  ABSENCE_REASONS, categoryLabel, GRADE_SUGGESTIONS, REQUEST_TYPES, STATUS_LABEL, type SubmissionRow,
} from "../../lib/my-family";
import { makeRequest, removeChild, reportAbsence, saveChild, saveFamilyDetails, type MyResult } from "./my-actions";

export type Details = { parentNames: string; phone: string; contact2Name: string; contact2Phone: string; contact2Relation: string };
export type ChildRow = { id: number; name: string; grade: string; teacher: string; bySchool: boolean };
export type Sent = SubmissionRow & { dates: string; sentAt: string; changedAt: string };

type Props = { name: string; email: string; details: Details; children: ChildRow[]; sent: Sent[]; today: string; tomorrow: string };

/** A form that calls a server action, shows its answer and keeps what was typed if it fails. */
function useAct(fn: (fd: FormData) => Promise<MyResult>, onOk?: (r: MyResult) => void) {
  const router = useRouter();
  const [res, setRes] = useState<MyResult | null>(null);
  const [pending, start] = useTransition();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await fn(fd);
      setRes(r);
      if (r.ok) { onOk?.(r); router.refresh(); }
      else if (r.field) (form.elements.namedItem(r.field) as HTMLElement | null)?.focus();
    });
  };
  const bad = (field: string) => (res?.field === field ? { "aria-invalid": true } : {});
  return { res, setRes, pending, onSubmit, bad };
}

function Msg({ res }: { res: MyResult | null }) {
  if (!res) return null;
  return res.error
    ? <p className="adm-msg adm-msg--err" role="alert">{res.error}</p>
    : <p className="adm-msg adm-msg--ok" role="status">{res.ok}</p>;
}

export const StatusPill = ({ s }: { s: Sent["status"] }) => <span className={`st st--${s}`}>{STATUS_LABEL[s]}</span>;

export function MyFamily({ name, email, details, children, sent, today, tomorrow }: Props) {
  const absences = sent.filter((s) => s.kind === "absence");
  const requests = sent.filter((s) => s.kind === "request");
  return (
    <div className="my">
      <div className="adm-card">
        <h1>My family</h1>
        <p className="lead">{name} · signed in as {email}. Only your family and the school office can see this page.</p>
        <nav className="my-jump" aria-label="On this page">
          <a href="#absence">Report an absence</a>
          <a href="#request">Make a request</a>
          <a href="#children">Children</a>
          <a href="#details">Family details</a>
        </nav>
      </div>
      <AbsenceCard kids={children} absences={absences} today={today} tomorrow={tomorrow} />
      <RequestCard kids={children} requests={requests} today={today} tomorrow={tomorrow} />
      <ChildrenCard kids={children} />
      <DetailsCard d={details} />
    </div>
  );
}

// ---------- Absences ----------
function AbsenceCard({ kids, absences, today, tomorrow }: { kids: ChildRow[]; absences: Sent[]; today: string; tomorrow: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { res, pending, onSubmit, bad } = useAct(reportAbsence, () => { formRef.current?.reset(); setFrom(""); setTo(""); });
  const pick = (d: string) => { setFrom(d); setTo(d); };
  return (
    <section className="adm-card" id="absence" aria-labelledby="absence-h">
      <h2 className="adm-h2" id="absence-h">Report an absence</h2>
      {kids.length ? (
        <form ref={formRef} className="adm-f" onSubmit={onSubmit} noValidate>
          <Msg res={res} />
          <label>
            Child
            <select key={kids.map((k) => k.id).join()} name="child_id" defaultValue={kids.length === 1 ? String(kids[0].id) : ""} {...bad("child_id")}>
              {kids.length > 1 && <option value="">Choose…</option>}
              {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </label>
          <div className="my-quick" role="group" aria-label="Quick dates">
            <button type="button" aria-pressed={from === today && to === today} onClick={() => pick(today)}>Today</button>
            <button type="button" aria-pressed={from === tomorrow && to === tomorrow} onClick={() => pick(tomorrow)}>Tomorrow</button>
          </div>
          <div className="adm-row">
            <label>
              First day
              <input type="date" name="date_from" value={from} onChange={(e) => { setFrom(e.target.value); if (!to || to < e.target.value) setTo(e.target.value); }} {...bad("date_from")} />
            </label>
            <label>
              Last day
              <input type="date" name="date_to" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              <span className="hint">The same day if it is only one day.</span>
            </label>
          </div>
          <fieldset {...bad("reason")}>
            <legend>Reason</legend>
            <div className="adm-radios">
              {Object.entries(ABSENCE_REASONS).map(([k, v]) => (
                <label key={k} className="adm-check"><input type="radio" name="reason" value={k} />{v}</label>
              ))}
            </div>
          </fieldset>
          <label>
            Note for the school <span className="hint">Optional, except for “Other”.</span>
            <textarea name="note" maxLength={1000} rows={3} {...bad("note")} />
          </label>
          <div className="adm-actions">
            <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Sending…" : "Send the absence"}</button>
          </div>
        </form>
      ) : (
        <p className="adm-empty">First add your children in <a href="#children">Children</a>. Then you can report an absence here.</p>
      )}
      <h3 className="my-h3">Your absences</h3>
      <SentList rows={absences} empty="You have not reported any absences yet." />
    </section>
  );
}

// ---------- Requests ----------
function RequestCard({ kids, requests, today, tomorrow }: { kids: ChildRow[]; requests: Sent[]; today: string; tomorrow: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [date, setDate] = useState("");
  const { res, pending, onSubmit, bad } = useAct(makeRequest, () => { formRef.current?.reset(); setDate(""); });
  return (
    <section className="adm-card" id="request" aria-labelledby="request-h">
      <h2 className="adm-h2" id="request-h">Make a request</h2>
      <form ref={formRef} className="adm-f" onSubmit={onSubmit} noValidate>
        <Msg res={res} />
        <fieldset {...bad("type")}>
          <legend>Type of request</legend>
          <div className="adm-radios">
            {Object.entries(REQUEST_TYPES).map(([k, v]) => (
              <label key={k} className="adm-check"><input type="radio" name="type" value={k} />{v}</label>
            ))}
          </div>
        </fieldset>
        <div className="adm-row">
          <label>
            Date
            <input type="date" name="date" value={date} onChange={(e) => setDate(e.target.value)} {...bad("date")} />
            <span className="my-quick my-quick--inline">
              <button type="button" aria-pressed={date === today} onClick={() => setDate(today)}>Today</button>
              <button type="button" aria-pressed={date === tomorrow} onClick={() => setDate(tomorrow)}>Tomorrow</button>
            </span>
          </label>
          <label>
            For
            <select name="child_id" defaultValue="" {...bad("child_id")}>
              <option value="">Whole family</option>
              {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </label>
        </div>
        <label>
          Message for the school
          <textarea name="message" maxLength={1000} rows={3} placeholder="For example: I will pick up my son at 1:30 PM for a dentist appointment." {...bad("message")} />
        </label>
        <div className="adm-actions">
          <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Sending…" : "Send the request"}</button>
        </div>
      </form>
      <h3 className="my-h3">Your requests</h3>
      <SentList rows={requests} empty="You have not made any requests yet." />
    </section>
  );
}

function SentList({ rows, empty }: { rows: Sent[]; empty: string }) {
  if (!rows.length) return <p className="adm-empty">{empty}</p>;
  return (
    <ul className="adm-list">
      {rows.map((s) => (
        <li key={s.id} className="adm-doc my-sent">
          <div className="what">
            <strong>{categoryLabel(s.kind, s.category)}{s.childName ? ` · ${s.childName}` : s.kind === "request" ? " · Whole family" : ""}</strong>
            <span className="note">{s.dates}</span>
            {s.message && <span className="msg">{s.message}</span>}
            <span className="note">Sent {s.sentAt}{s.changedAt && s.status !== "received" && <> · {STATUS_LABEL[s.status].toLowerCase()} since {s.changedAt}</>}</span>
          </div>
          <div className="act"><StatusPill s={s.status} /></div>
        </li>
      ))}
    </ul>
  );
}

// ---------- Children ----------
function ChildForm({ child, onDone }: { child?: ChildRow; onDone: (ok?: string) => void }) {
  const formRef = useRef<HTMLFormElement>(null);
  const { res, pending, onSubmit, bad } = useAct(saveChild, (r) => { formRef.current?.reset(); onDone(r.ok); });
  return (
    <form ref={formRef} className="adm-f adm-panel" onSubmit={onSubmit} noValidate>
      <h3 className="my-h3" style={{ margin: 0 }}>{child ? `Edit ${child.name}` : "Add a child"}</h3>
      {res?.error && <Msg res={res} />}
      {child && <input type="hidden" name="id" value={child.id} />}
      <label>
        Name
        <input type="text" name="name" defaultValue={child?.name} maxLength={100} autoComplete="off" autoFocus {...bad("name")} />
      </label>
      <div className="adm-row">
        <label>
          Grade
          <input type="text" name="grade" defaultValue={child?.grade} maxLength={40} list="grades" placeholder="For example: 3rd grade" {...bad("grade")} />
        </label>
        <label>
          Teacher <span className="hint">Optional</span>
          <input type="text" name="teacher" defaultValue={child?.teacher} maxLength={100} autoComplete="off" />
        </label>
      </div>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : child ? "Save" : "Add child"}</button>
        <button type="button" className="btn btn--outline" onClick={() => onDone()}>Cancel</button>
      </div>
    </form>
  );
}

function ChildrenCard({ kids }: { kids: ChildRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | "new" | null>(kids.length ? null : "new");
  const [confirm, setConfirm] = useState<number | null>(null);
  const [msg, setMsg] = useState<MyResult | null>(null);
  const [busy, start] = useTransition();
  const remove = (id: number) => start(async () => { setConfirm(null); setMsg(await removeChild(id)); router.refresh(); });
  const done = (text?: string) => { setEditing(null); if (text) setMsg({ ok: text }); };
  return (
    <section className="adm-card" id="children" aria-labelledby="children-h">
      <div className="adm-head">
        <div>
          <h2 className="adm-h2" id="children-h">Children</h2>
          <p className="lead">The school office can correct these details if something does not match its records.</p>
        </div>
        {editing === null && <button type="button" className="btn btn--outline" onClick={() => { setMsg(null); setEditing("new"); }}>Add a child</button>}
      </div>
      <datalist id="grades">{GRADE_SUGGESTIONS.map((g) => <option key={g} value={g} />)}</datalist>
      <Msg res={msg} />
      {editing === "new" && <ChildForm onDone={done} />}
      {kids.length ? (
        <ul className="adm-list">
          {kids.map((k) => editing === k.id ? (
            <li key={k.id} style={{ listStyle: "none" }}><ChildForm child={k} onDone={done} /></li>
          ) : (
            <li key={k.id} className="adm-doc">
              <div className="what">
                <strong>{k.name}</strong>
                <span className="note">{k.grade}{k.teacher && <> · {k.teacher}</>}{k.bySchool && <> · updated by the school</>}</span>
              </div>
              <div className="act">
                {confirm === k.id ? (
                  <span className="confirm">
                    <span>Remove {k.name}? Past absences stay in your list.</span>
                    <button type="button" className="danger" autoFocus disabled={busy} onClick={() => remove(k.id)}>Remove</button>
                    <button type="button" onClick={() => setConfirm(null)}>Cancel</button>
                  </span>
                ) : (<>
                  <button type="button" onClick={() => { setMsg(null); setEditing(k.id); }} disabled={editing !== null}>Edit</button>
                  <button type="button" onClick={() => { setMsg(null); setConfirm(k.id); }} disabled={editing !== null}>Remove</button>
                </>)}
              </div>
            </li>
          ))}
        </ul>
      ) : editing === null && <p className="adm-empty">No children on your list yet.</p>}
    </section>
  );
}

// ---------- Family details ----------
function DetailsCard({ d }: { d: Details }) {
  const { res, pending, onSubmit, bad } = useAct(saveFamilyDetails);
  return (
    <section className="adm-card" id="details" aria-labelledby="details-h">
      <h2 className="adm-h2" id="details-h">Family details</h2>
      <p className="lead">So the school knows who to call.</p>
      <form className="adm-f" onSubmit={onSubmit} noValidate>
        <Msg res={res} />
        <div className="adm-row">
          <label>
            Parents’ names
            <input type="text" name="parent_names" defaultValue={d.parentNames} maxLength={200} placeholder="For example: Maria and Jose Garcia" autoComplete="name" {...bad("parent_names")} />
          </label>
          <label>
            Phone
            <input type="tel" name="phone" defaultValue={d.phone} maxLength={40} placeholder="(303) 555-0123" autoComplete="tel" {...bad("phone")} />
          </label>
        </div>
        <fieldset>
          <legend>Second adult to contact (optional)</legend>
          <span className="hint">For example a grandparent or a neighbor who can pick up the children.</span>
          <div className="adm-row">
            <label>
              Name
              <input type="text" name="contact2_name" defaultValue={d.contact2Name} maxLength={100} autoComplete="off" {...bad("contact2_name")} />
            </label>
            <label>
              Phone
              <input type="tel" name="contact2_phone" defaultValue={d.contact2Phone} maxLength={40} autoComplete="off" {...bad("contact2_phone")} />
            </label>
          </div>
          <label>
            Relationship
            <input type="text" name="contact2_relation" defaultValue={d.contact2Relation} maxLength={60} placeholder="For example: Grandmother" autoComplete="off" />
          </label>
        </fieldset>
        <div className="adm-actions">
          <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : "Save family details"}</button>
        </div>
      </form>
    </section>
  );
}
