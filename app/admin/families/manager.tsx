"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FamilyStatus } from "../../../lib/family";
import { changeFamilyCode, renameFamily, setFamilyStatus, type FamilyResult } from "./actions";
import { inviteParent } from "./facts/actions";
import { Head, SearchField, SLink } from "../ui";

export type FamilyRow = {
  id: number; name: string; email: string; status: FamilyStatus; fromFacts: boolean;
  kids: { name: string; grade: string }[];
  parents: { id: string; email: string; active: boolean }[];
};

const PAGE = 20;

type Tab = "pending" | "approved" | "rejected";
const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: "pending", label: "Pending", empty: "No families are waiting for approval." },
  { key: "approved", label: "Approved", empty: "No approved families yet." },
  { key: "rejected", label: "Rejected", empty: "No rejected families." },
];
const tabOf = (s: FamilyStatus): Tab => (s === "disabled" ? "approved" : s);

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

  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [inviting, setInviting] = useState<number | null>(null);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const needle = q.trim().toLowerCase();
  const all = families.filter((f) => tabOf(f.status) === tab && (!needle || f.name.toLowerCase().includes(needle) || f.email.toLowerCase().includes(needle)
    || f.kids.some((k) => k.name.toLowerCase().includes(needle))));
  const pages = Math.max(1, Math.ceil(all.length / PAGE));
  const at = Math.min(page, pages - 1);
  const list = all.slice(at * PAGE, at * PAGE + PAGE);
  const count = (t: Tab) => families.filter((f) => tabOf(f.status) === t).length;
  const search = (v: string) => { setQ(v); setPage(0); };
  const go = (n: number) => { setPage(n); setConfirm(null); setEditing(null); setInviting(null); document.getElementById("fam-panel")?.scrollIntoView({ block: "start" }); };

  const saveName = async () => {
    if (!editing) return;
    setBusy(true);
    const r = await renameFamily(editing.id, editing.name);
    show(r); setBusy(false);
    if (!r.error) { setEditing(null); router.refresh(); }
  };
  const invite = async (f: FamilyRow, parentId: string) => {
    setBusy(true);
    const r = await inviteParent(parentId, emails[parentId] ?? f.parents.find((p) => p.id === parentId)?.email ?? "");
    show(r); setBusy(false);
    if (!r.error) { setInviting(null); router.refresh(); }
  };
  const kidsText = (f: FamilyRow) => f.kids.map((k) => (k.grade ? `${k.name} (${k.grade})` : k.name)).join(" · ");

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
      <SLink href={`/admin/families/${f.id}`}>Children &amp; details</SLink>
      <button type="button" onClick={() => setConfirm({ id: f.id, status: "disabled", question: `Turn off ${f.name}? They will be signed out.` })} disabled={busy}>Turn off</button>
    </>);
    if (f.status === "disabled") return (<>
      <SLink href={`/admin/families/${f.id}`}>Children &amp; details</SLink>
      <button type="button" onClick={() => change(f.id, "approved")} disabled={busy}>Turn back on</button>
    </>);
    return <button type="button" onClick={() => change(f.id, "approved")} disabled={busy}>Approve</button>;
  };

  return (
    <>
      <Head title="Families" lead={<>Families create their account at <strong>/family/register</strong> with the school code. They can sign in only after you approve them.</>}
        actions={<SLink className="btn btn--outline" href="/admin/families/facts">FACTS access</SLink>} />
      <div className="adm-card">
        {msg && <p className={`adm-msg ${msg.err ? "adm-msg--err" : "adm-msg--ok"}`} role="status">{msg.text}</p>}
        <div className="fam-tabs" role="tablist" aria-label="Families by status">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-controls="fam-panel" aria-selected={tab === t.key}
              onClick={() => { setTab(t.key); setPage(0); setConfirm(null); setEditing(null); setInviting(null); }}>
              {t.label}<span className={`n${t.key === "pending" && count(t.key) ? " n--hot" : ""}`}>{count(t.key)}</span>
            </button>
          ))}
        </div>
        {families.length > 10 && (
          <div className="sp-tools" style={{ marginTop: 12 }}>
            <SearchField label="Search families" value={q} onChange={search} placeholder="Search by family, child or email" />
          </div>
        )}
        <div id="fam-panel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {list.length ? (<>
            <ul className="adm-list">
              {list.map((f) => (
                <li key={f.id} className={`adm-doc fam-row${f.status === "disabled" ? " is-hidden" : ""}`}>
                  <div className="what">
                    {editing?.id === f.id ? (
                      <form className="fam-rename" onSubmit={(e) => { e.preventDefault(); saveName(); }}>
                        <label className="sr-only" htmlFor={`fam-name-${f.id}`}>Family name</label>
                        <input id={`fam-name-${f.id}`} autoFocus value={editing.name} maxLength={120} onChange={(e) => setEditing({ id: f.id, name: e.target.value })} />
                        <button type="submit" className="btn btn--primary" disabled={busy}>Save</button>
                        <button type="button" className="btn btn--outline" onClick={() => setEditing(null)}>Cancel</button>
                      </form>
                    ) : (
                      <strong>
                        {f.name}{f.status === "disabled" && <span className="pill pill--muted">Turned off</span>}
                        <button type="button" className="fam-edit" aria-label={`Edit the name of ${f.name}`} title="Edit name"
                          onClick={() => { setMsg(null); setInviting(null); setEditing({ id: f.id, name: f.name }); }}>
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                        </button>
                      </strong>
                    )}
                    <span className="note fam-mail">
                      {f.email || "(no email)"}
                      {!f.email && f.parents.some((p) => p.email) && <span>Invited: {f.parents.filter((p) => p.email).map((p) => p.email).join(", ")}</span>}
                      {!f.email && f.parents.length > 0 && f.status !== "rejected" && (
                        <button type="button" className="fam-invite" aria-expanded={inviting === f.id}
                          onClick={() => { setMsg(null); setEditing(null); setInviting(inviting === f.id ? null : f.id); }}>
                          {f.parents.some((p) => p.email) ? "Send the invitation again" : "Send invitation to create the account"}
                        </button>
                      )}
                    </span>
                    <span className="note">{f.kids.length ? kidsText(f) : "No children yet"}</span>
                    {inviting === f.id && (
                      <div className="fam-inv" role="group" aria-label={`Invite a parent of ${f.name}`}>
                        <p className="note">The parent gets a link to create the account (it works for 7 days, once). Only parents FACTS lets see a child are listed.</p>
                        {f.parents.map((p) => (
                          <form key={p.id} className="fam-inv-row" onSubmit={(e) => { e.preventDefault(); invite(f, p.id); }}>
                            <span className="pid">FACTS Parent ID {p.id}</span>
                            {p.active ? <span className="note">Already has an account</span> : (<>
                              <label className="sr-only" htmlFor={`inv-${p.id}`}>Email for Parent ID {p.id}</label>
                              <input id={`inv-${p.id}`} type="email" placeholder="Parent's email" value={emails[p.id] ?? p.email}
                                onChange={(e) => setEmails({ ...emails, [p.id]: e.target.value })} />
                              <button type="submit" className="btn btn--primary" disabled={busy}>Send</button>
                            </>)}
                          </form>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="act">{actions(f)}</div>
                </li>
              ))}
            </ul>
            {pages > 1 && (
              <nav className="fam-pager" aria-label="Pages">
                <button type="button" className="btn btn--outline" onClick={() => go(at - 1)} disabled={at === 0}>Previous</button>
                <span aria-live="polite">Page {at + 1} of {pages} · {all.length} families</span>
                <button type="button" className="btn btn--outline" onClick={() => go(at + 1)} disabled={at >= pages - 1}>Next</button>
              </nav>
            )}
            </>
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
