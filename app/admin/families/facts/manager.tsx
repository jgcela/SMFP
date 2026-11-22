"use client";
// FACTS access: import the FACTS report (preview first), see each FACTS parent's
// account status, invite them by email (one by one or with a file).
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useMemo, useRef, useState, useTransition } from "react";
import { PARENT_STATUS_LABEL, type ParentRow, type ParentStatus } from "../../../../lib/facts-labels";
import { applyAccess, applyEmails, inviteParent, previewAccess, previewEmails, type AccessPreview, type EmailsPreview, type InviteResult } from "./actions";
import { Head, SLink } from "../../ui";

const n = (x: number | undefined, one: string, many = `${one}s`) => `${x ?? 0} ${(x ?? 0) === 1 ? one : many}`;
const when = (iso: string | null) =>
  iso ? new Date(iso.replace(" ", "T").replace(/(\+\d\d)$/, "$1:00")).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";

function Msg({ text, err }: { text?: string; err?: boolean }) {
  if (!text) return null;
  return <p className={`adm-msg ${err ? "adm-msg--err" : "adm-msg--ok"}`} role={err ? "alert" : "status"}>{text}</p>;
}

function Details({ title, children, count }: { title: string; count: number; children: React.ReactNode }) {
  if (!count) return null;
  return (
    <details className="adm-panel" style={{ marginTop: 8 }}>
      <summary><strong>{title}</strong> ({count})</summary>
      {children}
    </details>
  );
}

// ---------------------------------------------------------------------------

function AccessImport({ onReset }: { onReset: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<AccessPreview | undefined, FormData>(previewAccess, undefined);
  const [result, setResult] = useState<AccessPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const file = useRef<File | null>(null);
  const shown = result ?? state;
  const s = shown?.summary;

  const save = async () => {
    if (!file.current || !shown?.fingerprint) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("file", file.current);
    fd.set("fingerprint", shown.fingerprint);
    const r = await applyAccess(fd);
    setSaving(false);
    setResult(r);
    if (r.done) router.refresh();
  };
  const reset = onReset;

  return (
    <div className="adm-card">
      <h2 className="adm-h2">Import the FACTS access report</h2>
      <p className="lead">
        The CSV from FACTS with <b>Student ID (System)</b>, <b>Parent Individual ID</b>, <b>Family ID</b> and <b>Has access to Parents Web</b>.
        Only these columns are read; names, grade and Family Order are ignored and never saved. Nothing changes until you check the preview and press Apply.
      </p>
      {!s && (
        <form className="adm-f" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const f = fd.get("file");
          file.current = f instanceof File ? f : null;
          setResult(null);
          startTransition(() => action(fd));
        }}>
          <Msg text={shown?.error} err />
          <label>File<input type="file" name="file" accept=".csv,text/csv" required /></label>
          <div className="adm-actions"><button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Reading…" : "Preview"}</button></div>
        </form>
      )}
      {s && (
        <>
          {shown?.done && <Msg text={`Applied. Access given: ${s.activate} (${s.activateNow} active now, ${s.activatePending} waiting for the parent’s account). Revoked: ${s.revoke}. Suspended by a conflict: ${s.suspend}. Importing the same file again changes nothing.`} />}
          {shown?.stale && <Msg err text="Someone changed FACTS access since this preview. Here is the new preview: check it and press Apply again." />}
          {shown?.error && <Msg err text={shown.error} />}
          <p className="note">{shown?.fileName}</p>
          <div className="adm-tablewrap">
            <table className="adm-table">
              <tbody>
                <tr><th scope="row">Rows read</th><td>{s.rowsRead}</td></tr>
                <tr><th scope="row">Unique adult–student links</th><td>{s.uniqueLinks}</td></tr>
                <tr><th scope="row">Access that will be turned on (Yes)</th><td>{s.activate} <span className="note">({s.activateNow} at once · {s.activatePending} when the adult’s account is verified)</span></td></tr>
                <tr><th scope="row">Access that will be revoked (No)</th><td>{s.revoke}</td></tr>
                <tr><th scope="row">Access suspended by a Yes/No conflict</th><td>{s.suspend}</td></tr>
                <tr><th scope="row">New links without access (No)</th><td>{s.newWithoutAccess}</td></tr>
                <tr><th scope="row">Already up to date</th><td>{s.unchanged}</td></tr>
                <tr><th scope="row">Repeated rows (applied once)</th><td>{s.duplicateRows}</td></tr>
                <tr><th scope="row">Conflicts (Yes and No for the same link)</th><td>{s.conflicts}</td></tr>
                <tr><th scope="row">Invalid rows (not applied)</th><td>{s.invalidRows}{s.invalidLinks ? <span className="note"> · {n(s.invalidLinks, "link")} left unchanged</span> : null}</td></tr>
                <tr><th scope="row">Parents waiting for their account to be linked</th><td>{s.pendingParents}</td></tr>
                <tr><th scope="row">Students with access but no child set up in the portal</th><td>{s.studentsWithoutChild}</td></tr>
              </tbody>
            </table>
          </div>
          <Details title="Invalid rows" count={shown?.invalidRows?.length ?? 0}>
            <ul>{shown?.invalidRows?.map((r) => <li key={r.line}>Line {r.line}: {r.problem}</li>)}</ul>
          </Details>
          <Details title="Conflicts: no access until a later file is consistent" count={shown?.conflicts?.length ?? 0}>
            <ul>{shown?.conflicts?.map((c) => <li key={`${c.parent}-${c.student}`}>Parent {c.parent} · student {c.student}{c.suspends ? " (had access: suspended)" : ""}</li>)}</ul>
          </Details>
          <Details title="Parents waiting for their account to be linked" count={shown?.pendingParents?.length ?? 0}>
            <p className="note">Their access starts when they accept an invitation (below).</p>
            <ul>{shown?.pendingParents?.map((p) => <li key={p}>{p}</li>)}</ul>
          </Details>
          <div className="adm-actions">
            {!shown?.done && (
              <button type="button" className="btn btn--primary" onClick={save} disabled={saving || !file.current}>
                {saving ? "Applying…" : "Apply"}
              </button>
            )}
            <button type="button" className="btn btn--outline" onClick={reset} disabled={saving}>{shown?.done ? "Import another file" : "Choose another file"}</button>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

const TABS: { key: ParentStatus; empty: string }[] = [
  { key: "pending_email", empty: "Every FACTS parent has an email or an account." },
  { key: "invited", empty: "No open invitations." },
  { key: "expired", empty: "No expired invitations." },
  { key: "active", empty: "No parent has linked an account yet." },
];

function ParentLine({ p, onResult }: { p: ParentRow; onResult: (r: InviteResult) => void }) {
  const router = useRouter();
  const [email, setEmail] = useState(p.email ?? "");
  const [res, setRes] = useState<InviteResult | null>(null);
  const [busy, start] = useTransition();
  // A success moves the parent to another tab, so it is announced above the list.
  const send = (value: string) => start(async () => {
    const r = await inviteParent(p.parentId, value);
    if (r.ok) { setRes(null); onResult(r); router.refresh(); } else setRes(r);
  });
  return (
    <li className="adm-doc">
      <div className="what">
        <strong>Parent ID {p.parentId}</strong>
        <span className="note">
          {p.status === "active" ? <>Account: {p.accountEmail}</> : p.email ? <>Email: {p.email}</> : "No email yet"}
          {p.status === "invited" && p.expiresAt && <> · link works until {when(p.expiresAt)}</>}
          {p.status === "expired" && p.invitedAt && <> · invited {when(p.invitedAt)}, not used</>}
          {" · "}{n(p.studentsGranted, "student")} with FACTS access{p.conflicts ? ` · ${n(p.conflicts, "conflict")}` : ""}
        </span>
        {res && <Msg text={res.error ?? res.ok} err={!!res.error} />}
      </div>
      <div className="act">
        {p.status === "pending_email" && (
          <form onSubmit={(e) => { e.preventDefault(); send(email); }} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label className="sr-only" htmlFor={`em-${p.parentId}`}>Email for parent {p.parentId}</label>
            <input id={`em-${p.parentId}`} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" maxLength={200} required />
            <button type="submit" disabled={busy}>{busy ? "Sending…" : "Send invitation"}</button>
          </form>
        )}
        {(p.status === "invited" || p.status === "expired") && (
          <button type="button" onClick={() => send("")} disabled={busy}>{busy ? "Sending…" : "Resend"}</button>
        )}
      </div>
    </li>
  );
}

function Parents({ parents }: { parents: ParentRow[] }) {
  const [tab, setTab] = useState<ParentStatus>(parents.some((p) => p.status === "pending_email") || !parents.length ? "pending_email" : "invited");
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState<InviteResult | null>(null);
  const count = (t: ParentStatus) => parents.filter((p) => p.status === t).length;
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return parents.filter((p) => p.status === tab && (!s || p.parentId.toLowerCase().includes(s) || (p.email ?? "").includes(s) || (p.accountEmail ?? "").toLowerCase().includes(s)));
  }, [parents, tab, q]);
  return (
    <div className="adm-card">
      <h2 className="adm-h2">FACTS parents and their accounts</h2>
      <p className="lead">A parent sees their children only after opening the invitation and choosing (or confirming) their password. The link works for 7 days, once. Sending it again cancels the old one.</p>
      {notice && <Msg text={notice.ok ?? notice.error} err={!!notice.error} />}
      <div className="fam-tabs" role="tablist" aria-label="FACTS parents by status">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" id={`ptab-${t.key}`} aria-controls="facts-panel" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {PARENT_STATUS_LABEL[t.key]}<span className="n">{count(t.key)}</span>
          </button>
        ))}
      </div>
      <div className="adm-f" style={{ marginTop: 12 }}>
        <label>Search by Parent ID or email<input type="search" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>
      <div id="facts-panel" role="tabpanel" aria-labelledby={`ptab-${tab}`}>
        {list.length ? (
          <ul className="adm-list">{list.slice(0, 300).map((p) => <ParentLine key={p.parentId} p={p} onResult={setNotice} />)}</ul>
        ) : <p className="adm-empty">{q ? "No parent matches the search." : TABS.find((t) => t.key === tab)!.empty}</p>}
        {list.length > 300 && <p className="note">Showing 300 of {list.length}. Search to find the others.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EmailsImport({ onReset }: { onReset: () => void }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<EmailsPreview | undefined, FormData>(previewEmails, undefined);
  const [result, setResult] = useState<EmailsPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const file = useRef<File | null>(null);
  const shown = result ?? state;
  const ready = shown && !shown.error && shown.rowsRead !== undefined;

  const save = async () => {
    if (!file.current) return;
    setSaving(true);
    const fd = new FormData();
    fd.set("file", file.current);
    const r = await applyEmails(fd);
    setSaving(false);
    setResult(r);
    if (r.done) router.refresh();
  };
  const reset = onReset;

  return (
    <div className="adm-card">
      <h2 className="adm-h2">Import parent emails</h2>
      <p className="lead">A CSV with the columns <b>Parent Individual ID</b> and <b>Email</b>. Each parent gets the same invitation as above. Parents who are already active, or already invited with the same email, get nothing new.</p>
      {!ready && (
        <form className="adm-f" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const f = fd.get("file");
          file.current = f instanceof File ? f : null;
          setResult(null);
          startTransition(() => action(fd));
        }}>
          <Msg text={shown?.error} err />
          <label>File<input type="file" name="file" accept=".csv,text/csv" required /></label>
          <div className="adm-actions"><button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Reading…" : "Preview"}</button></div>
        </form>
      )}
      {ready && (
        <>
          {shown.done && <Msg text={`Done. ${n(shown.invite?.length, "invitation")} saved, ${n(shown.sent, "email")} sent.`} />}
          <p className="note">{shown.fileName}: {n(shown.rowsRead, "row")} read{shown.duplicateRows ? `, ${n(shown.duplicateRows, "repeated row")} used once` : ""}.</p>
          <ul>
            <li>{shown.done ? "Invited" : "Will be invited"}: {shown.invite?.length ?? 0}</li>
            <li>Nothing to send (already active or already invited): {shown.skipped?.length ?? 0}</li>
            <li>Not possible: {shown.refused?.length ?? 0}</li>
            <li>Badly written emails or empty IDs: {shown.invalid?.length ?? 0}</li>
            <li>Same Parent ID with two different emails: {shown.idWithTwoEmails?.length ?? 0}</li>
            <li>Same email for two Parent IDs: {shown.emailWithTwoIds?.length ?? 0}</li>
          </ul>
          <Details title={shown.done ? "Invited" : "Will be invited"} count={shown.invite?.length ?? 0}>
            <ul>{shown.invite?.slice(0, 200).map((r) => <li key={r.parentId}>{r.parentId} · {r.email}{r.mode === "existing_account" ? " (has an account: confirms with its password)" : ""}</li>)}</ul>
          </Details>
          <Details title="Badly written emails or empty IDs" count={shown.invalid?.length ?? 0}>
            <ul>{shown.invalid?.map((r) => <li key={r.line}>Line {r.line}: {r.problem}</li>)}</ul>
          </Details>
          <Details title="Same Parent ID with two different emails (not sent)" count={shown.idWithTwoEmails?.length ?? 0}>
            <ul>{shown.idWithTwoEmails?.map((r) => <li key={r.parentId}>{r.parentId}: {r.emails.join(", ")}</li>)}</ul>
          </Details>
          <Details title="Same email for two Parent IDs (not sent)" count={shown.emailWithTwoIds?.length ?? 0}>
            <ul>{shown.emailWithTwoIds?.map((r) => <li key={r.email}>{r.email}: {r.parentIds.join(", ")}</li>)}</ul>
          </Details>
          <Details title="Not possible" count={shown.refused?.length ?? 0}>
            <ul>{shown.refused?.map((r) => <li key={r.parentId}>{r.parentId} · {r.email}: {r.reason}</li>)}</ul>
          </Details>
          <Details title="Nothing to send" count={shown.skipped?.length ?? 0}>
            <ul>{shown.skipped?.map((r) => <li key={r.parentId}>{r.parentId} · {r.email}: {r.reason}</li>)}</ul>
          </Details>
          <div className="adm-actions">
            {!shown.done && <button type="button" className="btn btn--primary" onClick={save} disabled={saving || !shown.invite?.length}>{saving ? "Sending…" : `Send ${n(shown.invite?.length, "invitation")}`}</button>}
            <button type="button" className="btn btn--outline" onClick={reset} disabled={saving}>{shown.done ? "Import another file" : "Choose another file"}</button>
          </div>
        </>
      )}
    </div>
  );
}

export function FactsManager({ parents }: { parents: ParentRow[] }) {
  const [k, setK] = useState({ access: 0, emails: 0 });
  return (
    <>
      <Head back={<SLink href="/admin/families">← Families</SLink>} title="FACTS access"
        lead="Which parents may see which students, from the FACTS Parents Web report. A child is matched by its FACTS Student ID (set it in “Children & details”). For those children, only FACTS decides who sees them." />
      <AccessImport key={`a${k.access}`} onReset={() => setK({ ...k, access: k.access + 1 })} />
      <Parents parents={parents} />
      <EmailsImport key={`e${k.emails}`} onReset={() => setK({ ...k, emails: k.emails + 1 })} />
    </>
  );
}
