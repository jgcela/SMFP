"use client";
// "My family": what an approved family sees after signing in.
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  ABSENCE_REASONS, categoryLabel, REQUEST_TYPES, STATUS_LABEL, type SubmissionRow,
} from "../../lib/my-family";
import { makeRequest, reportAbsence, saveFamilyDetails, type MyResult } from "./my-actions";
import { DateBlock } from "../admin/calendar/manager";
import { Head, Initials } from "../admin/ui";

export type Details = { parentNames: string; phone: string; contact2Name: string; contact2Phone: string; contact2Relation: string };
export type ChildRow = { id: number; name: string; grade: string; teacher: string };
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
  const open = sent.filter((s) => s.status !== "resolved").length;
  return (
    <div className="my">
      <Head title="My family" lead={<>{name} · signed in as {email}. Only your family and the school office can see this page.</>} />
      <div className="my-grid">
        <div className="my-col my-col--main">
          <AbsenceCard kids={children} today={today} tomorrow={tomorrow} />
          <RequestCard kids={children} today={today} tomorrow={tomorrow} />
          <DetailsCard d={details} />
        </div>
        <div className="my-col my-col--side">
          <ChildrenCard kids={children} />
          <section className="adm-card my-sentcard" aria-labelledby="sent-h">
            <h2 className="sp-card-h" id="sent-h">What you sent {open > 0 && <span className="my-open">{open} not resolved</span>}</h2>
            <h3 className="my-h3">Absences</h3>
            <SentList rows={absences} empty="You have not reported any absences yet." />
            <h3 className="my-h3">Requests</h3>
            <SentList rows={requests} empty="You have not made any requests yet." />
          </section>
        </div>
      </div>
    </div>
  );
}

// ---------- Absences ----------
function AbsenceCard({ kids, today, tomorrow }: { kids: ChildRow[]; today: string; tomorrow: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { res, pending, onSubmit, bad } = useAct(reportAbsence, () => { formRef.current?.reset(); setFrom(""); setTo(""); });
  const pick = (d: string) => { setFrom(d); setTo(d); };
  return (
    <section className="adm-card" id="absence" aria-labelledby="absence-h">
      <h2 className="sp-card-h" id="absence-h">Report an absence</h2>
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
        <p className="adm-empty">The school has not added your children to your account yet. Until it does, call the school office to report an absence.</p>
      )}
    </section>
  );
}

// ---------- Requests ----------
function RequestCard({ kids, today, tomorrow }: { kids: ChildRow[]; today: string; tomorrow: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [date, setDate] = useState("");
  const { res, pending, onSubmit, bad } = useAct(makeRequest, () => { formRef.current?.reset(); setDate(""); });
  return (
    <section className="adm-card" id="request" aria-labelledby="request-h">
      <h2 className="sp-card-h" id="request-h">Make a request</h2>
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
          <button type="submit" className="btn btn--outline" disabled={pending}>{pending ? "Sending…" : "Send the request"}</button>
        </div>
      </form>
    </section>
  );
}

function SentList({ rows, empty }: { rows: Sent[]; empty: string }) {
  if (!rows.length) return <p className="adm-empty">{empty}</p>;
  return (
    <ul className="sp-list">
      {rows.map((s) => (
        <li key={s.id} className={`sp-ev my-sent${s.status === "resolved" ? " is-done" : ""}`}>
          <DateBlock from={s.dateFrom} to={s.dateTo} />
          <div className="sp-ev-what">
            <strong>{categoryLabel(s.kind, s.category)}{s.childName ? ` · ${s.childName}` : s.kind === "request" ? " · Whole family" : ""}</strong>
            <span className="sp-ev-meta"><StatusPill s={s.status} /></span>
            {s.message && <span className="msg">{s.message}</span>}
            <span className="note">Sent {s.sentAt}{s.changedAt && s.status !== "received" && <> · {STATUS_LABEL[s.status].toLowerCase()} since {s.changedAt}</>}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- Children (added by the school; later from FACTS) ----------
function ChildrenCard({ kids }: { kids: ChildRow[] }) {
  return (
    <section className="adm-card" id="children" aria-labelledby="children-h">
      <h2 className="sp-card-h" id="children-h">Children</h2>
      <p className="lead">The school office keeps this list. If something is missing or wrong, contact the office.</p>
      {kids.length ? (
        <ul className="sp-rows">
          {kids.map((k) => (
            <li key={k.id} className="sp-person my-kid">
              <Initials name={k.name} />
              <span>
                <strong>{k.name}</strong>
                <span className="note">{k.grade}{k.teacher && <> · {k.teacher}</>}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="adm-empty">The school has not added your children yet.</p>}
    </section>
  );
}

// ---------- Family details ----------
function DetailsCard({ d }: { d: Details }) {
  const { res, pending, onSubmit, bad } = useAct(saveFamilyDetails);
  return (
    <section className="adm-card" id="details" aria-labelledby="details-h">
      <h2 className="sp-card-h" id="details-h">Family details</h2>
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
          <button type="submit" className="btn btn--outline" disabled={pending}>{pending ? "Saving…" : "Save family details"}</button>
        </div>
      </form>
    </section>
  );
}
