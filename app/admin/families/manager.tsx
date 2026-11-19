"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FamilyStatus } from "../../../lib/family";
import { changeFamilyCode, setFamilyStatus, type FamilyResult } from "./actions";

export type FamilyRow = {
  id: number; name: string; email: string; status: FamilyStatus; createdAt: string; decidedAt: string | null; decidedBy: string;
};

type Tab = "pending" | "approved" | "rejected";
const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: "pending", label: "Pending", empty: "No families are waiting for approval." },
  { key: "approved", label: "Approved", empty: "No approved families yet." },
  { key: "rejected", label: "Rejected", empty: "No rejected families." },
];
const tabOf = (s: FamilyStatus): Tab => (s === "disabled" ? "approved" : s);

const when = (iso: string) =>
  new Date(iso.replace(" ", "T").replace(/(\+\d\d)$/, "$1:00")).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

type Confirm = { id: number; status: FamilyStatus; question: string } | null;

export function FamiliesManager({ families, code }: { families: FamilyRow[]; code: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(families.some((f) => f.status === "pending") || !families.length ? "pending" : "approved");
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [current, setCurrent] = useState(code);
  const [askCode, setAskCode] = useState(false);

  const show = (r: FamilyResult) => setMsg(r.error ? { text: r.error, err: true } : { text: r.ok ?? "" });
  const change = async (id: number, status: FamilyStatus) => {
    setBusy(true); setConfirm(null);
    show(await setFamilyStatus(id, status));
    setBusy(false); router.refresh();
  };
  const newCode = async () => {
    setBusy(true); setAskCode(false);
    const r = await changeFamilyCode();
    if (r.code) setCurrent(r.code);
    show(r); setBusy(false); router.refresh();
  };

  const list = families.filter((f) => tabOf(f.status) === tab);
  const count = (t: Tab) => families.filter((f) => tabOf(f.status) === t).length;

  const actions = (f: FamilyRow) => {
    if (confirm?.id === f.id) {
      return (
        <span className="confirm" role="group" aria-label={confirm.question}>
          <span>{confirm.question}</span>
          <button type="button" className="danger" autoFocus onClick={() => change(f.id, confirm.status)} disabled={busy}>Yes</button>
          <button type="button" onClick={() => setConfirm(null)}>Cancel</button>
        </span>
      );
    }
    if (f.status === "pending") return (<>
      <button type="button" className="ok" onClick={() => change(f.id, "approved")} disabled={busy}>Approve</button>
      <button type="button" onClick={() => setConfirm({ id: f.id, status: "rejected", question: `Reject ${f.name}?` })} disabled={busy}>Reject</button>
    </>);
    if (f.status === "approved") return (<>
      <Link href={`/admin/families/${f.id}`}>Children &amp; details</Link>
      <button type="button" onClick={() => setConfirm({ id: f.id, status: "disabled", question: `Turn off ${f.name}? They will be signed out.` })} disabled={busy}>Turn off</button>
    </>);
    if (f.status === "disabled") return (<>
      <Link href={`/admin/families/${f.id}`}>Children &amp; details</Link>
      <button type="button" onClick={() => change(f.id, "approved")} disabled={busy}>Turn back on</button>
    </>);
    return <button type="button" onClick={() => change(f.id, "approved")} disabled={busy}>Approve</button>;
  };

  return (
    <>
      <div className="adm-card">
        <div className="adm-head">
          <div>
            <h1>Families</h1>
            <p className="lead">Families create their account at <strong>/family/register</strong> with the school code. They can sign in only after you approve them.</p>
          </div>
        </div>
        {msg && <p className={`adm-msg ${msg.err ? "adm-msg--err" : "adm-msg--ok"}`} role="status">{msg.text}</p>}
        <div className="fam-tabs" role="tablist" aria-label="Families by status">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-controls="fam-panel" aria-selected={tab === t.key}
              onClick={() => { setTab(t.key); setConfirm(null); }}>
              {t.label}<span className={`n${t.key === "pending" && count(t.key) ? " n--hot" : ""}`}>{count(t.key)}</span>
            </button>
          ))}
        </div>
        <div id="fam-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {list.length ? (
            <ul className="adm-list">
              {list.map((f) => (
                <li key={f.id} className={`adm-doc${f.status === "disabled" ? " is-hidden" : ""}`}>
                  <div className="what">
                    <strong>{f.name}{f.status === "disabled" && <span className="pill pill--muted">Turned off</span>}</strong>
                    <span className="note adm-href">{f.email}</span>
                    <span className="note">
                      Registered {when(f.createdAt)}
                      {f.decidedAt && f.status !== "pending" && <> · {f.status === "approved" ? "approved" : f.status === "rejected" ? "rejected" : "turned off"} {when(f.decidedAt)}{f.decidedBy && <> by {f.decidedBy}</>}</>}
                    </span>
                  </div>
                  <div className="act">{actions(f)}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="adm-empty">{TABS.find((t) => t.key === tab)!.empty}</p>
          )}
        </div>
      </div>

      <div className="adm-card">
        <h2 className="adm-h2">School code</h2>
        <p className="lead">Give this code to families so they can create their account. Change it if it reaches people outside the school: the old code stops working at once. Families already registered are not affected.</p>
        <div className="fam-code">
          <span className="code" aria-label="Current school code">{current || "No code yet"}</span>
          {askCode ? (
            <span className="confirm adm-doc" role="group" aria-label="Make a new code?" style={{ border: 0, padding: 0 }}>
              <span>The current code will stop working.</span>
              <span className="act">
                <button type="button" className="danger" autoFocus onClick={newCode} disabled={busy}>Make a new code</button>
                <button type="button" onClick={() => setAskCode(false)}>Cancel</button>
              </span>
            </span>
          ) : (
            <button type="button" className="btn btn--outline" onClick={() => { setMsg(null); setAskCode(true); }} disabled={busy}>Change the code</button>
          )}
        </div>
      </div>
    </>
  );
}
