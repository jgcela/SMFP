"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { categoryLabel, KIND_LABEL, STATUS_LABEL, type SubmissionKind, type SubmissionStatus } from "../../../lib/my-family";
import { setSubmissionStatus, type StatusResult } from "./actions";

export type StaffRow = {
  id: number; kind: SubmissionKind; category: string; childName: string; dateFrom: string; dateTo: string; message: string;
  status: SubmissionStatus; statusBy: string; familyId: number; familyName: string; phone: string; parentNames: string;
  dates: string; sentAt: string; changedAt: string;
};
type Filters = { from: string; to: string; status: string; kind: string };

const STATUSES: SubmissionStatus[] = ["received", "in_progress", "resolved"];

export function RequestsList({ rows, filters, today, tomorrow, week }: { rows: StaffRow[]; filters: Filters; today: string; tomorrow: string; week: string }) {
  const router = useRouter();
  const [f, setF] = useState(filters);
  const [msg, setMsg] = useState<(StatusResult & { id?: number }) | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [, start] = useTransition();

  const go = (next: Filters) => {
    setF(next); setMsg(null);
    const q = new URLSearchParams(Object.entries(next).filter(([, v]) => v));
    router.push(`/admin/requests${q.size ? `?${q}` : ""}`);
  };
  const range = (from: string, to: string) => go({ ...f, from, to });
  const isRange = (from: string, to: string) => f.from === from && f.to === to;

  const change = (id: number, status: SubmissionStatus) => {
    setBusyId(id);
    start(async () => {
      const r = await setSubmissionStatus(id, status);
      setMsg({ ...r, id }); setBusyId(null); router.refresh();
    });
  };

  const open = rows.filter((r) => r.status !== "resolved").length;
  return (
    <div className="adm-card">
      <div className="adm-head">
        <div>
          <h1>Absences &amp; requests</h1>
          <p className="lead">What families send from “My family”. Change the status so the family knows where it stands.</p>
        </div>
      </div>

      <form className="adm-f rq-filters" onSubmit={(e) => { e.preventDefault(); go(f); }} aria-label="Filters">
        <div className="my-quick" role="group" aria-label="Dates">
          <button type="button" aria-pressed={isRange(today, today)} onClick={() => range(today, today)}>Today</button>
          <button type="button" aria-pressed={isRange(tomorrow, tomorrow)} onClick={() => range(tomorrow, tomorrow)}>Tomorrow</button>
          <button type="button" aria-pressed={isRange(today, week)} onClick={() => range(today, week)}>Next 7 days</button>
          <button type="button" aria-pressed={!f.from && !f.to} onClick={() => range("", "")}>All dates</button>
        </div>
        <div className="rq-row">
          <label>From<input type="date" value={f.from} onChange={(e) => go({ ...f, from: e.target.value })} /></label>
          <label>To<input type="date" value={f.to} min={f.from || undefined} onChange={(e) => go({ ...f, to: e.target.value })} /></label>
          <label>
            Status
            <select value={f.status} onChange={(e) => go({ ...f, status: e.target.value })}>
              <option value="">All</option>
              <option value="open">Not resolved</option>
              {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </label>
          <label>
            Type
            <select value={f.kind} onChange={(e) => go({ ...f, kind: e.target.value })}>
              <option value="">All</option>
              <option value="absence">Only absences</option>
              <option value="request">Only requests</option>
            </select>
          </label>
        </div>
      </form>

      <p className="adm-count" role="status">
        {rows.length === 500 ? "Showing the first 500. Use the filters to see the rest." : `${rows.length} shown`}{rows.length ? ` · ${open} not resolved` : ""}
      </p>
      {msg && !msg.id && msg.error && <p className="adm-msg adm-msg--err" role="alert">{msg.error}</p>}

      {rows.length ? (
        <ul className="adm-list">
          {rows.map((r) => (
            <li key={r.id} className={`rq${r.status === "resolved" ? " is-done" : ""}`}>
              <div className="when">
                <span className={`cat ${r.kind === "absence" ? "cat--noclasses" : "cat--academic"}`}>{KIND_LABEL[r.kind]}</span>
                <span>{r.dates}</span>
              </div>
              <div className="what">
                <strong>{categoryLabel(r.kind, r.category)} · {r.childName || "Whole family"}</strong>
                <span className="note">
                  <Link href={`/admin/families/${r.familyId}`}>{r.familyName}</Link>
                  {r.parentNames && <> · {r.parentNames}</>}
                  {r.phone && <> · <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`}>{r.phone}</a></>}
                </span>
                {r.message && <span className="msg">{r.message}</span>}
                <span className="note">Sent {r.sentAt}{r.changedAt && <> · {STATUS_LABEL[r.status].toLowerCase()} {r.changedAt}{r.statusBy && <> by {r.statusBy}</>}</>}</span>
                {msg?.id === r.id && <span className={`adm-msg ${msg.error ? "adm-msg--err" : "adm-msg--ok"}`} role="status">{msg.error ?? msg.ok}</span>}
              </div>
              <div className="rq-st" role="group" aria-label={`Status of ${categoryLabel(r.kind, r.category)} for ${r.childName || r.familyName}`}>
                {STATUSES.map((s) => (
                  <button key={s} type="button" className={`st-btn st-btn--${s}`} aria-pressed={r.status === s}
                    disabled={busyId === r.id} onClick={() => r.status !== s && change(r.id, s)}>
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-empty">{filters.from || filters.to || filters.status || filters.kind ? "Nothing matches these filters." : "Families have not sent anything yet."}</p>
      )}
    </div>
  );
}
