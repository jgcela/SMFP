"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createPage, deletePage } from "./actions";

export type PageRow = {
  id: number; slug: string; title: string; legacy: string; publishedAt: string | null; updatedAt: string; unpublishedChanges: boolean;
};

export function PagesList({ pages }: { pages: PageRow[] }) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const router = useRouter();

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await createPage(title);
    setBusy(false);
    if (r.error || !r.id) { setMsg({ text: r.error ?? "Could not create the page.", err: true }); return; }
    router.push(`/admin/pages/${r.id}`);
  };

  return (
    <div className="adm-card">
      <div className="adm-head">
        <div>
          <h1>Pages</h1>
          <p className="lead">The portal’s text pages. Edit a draft, then press “Publish”: families only see what is published.</p>
        </div>
        <div className="adm-actions">
          <button type="button" className="btn btn--primary" onClick={() => { setMsg(null); setAdding(true); }}>New page</button>
        </div>
      </div>
      {msg && <p className={`adm-msg ${msg.err ? "adm-msg--err" : "adm-msg--ok"}`} role="status">{msg.text}</p>}
      {adding && (
        <form className="adm-f adm-panel" onSubmit={create}>
          <h2>New page</h2>
          <label>
            Title
            <input type="text" maxLength={120} required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <div className="adm-actions">
            <button type="submit" className="btn btn--primary" disabled={busy || !title.trim()}>{busy ? "Creating…" : "Create and edit"}</button>
            <button type="button" className="btn btn--outline" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </form>
      )}
      {pages.length ? (
        <ul className="adm-list">
          {pages.map((p) => (
            <li key={p.id} className="adm-doc">
              <div className="what">
                <strong>
                  {p.title}
                  {!p.publishedAt ? <span className="pill pill--muted">Not published</span>
                    : p.unpublishedChanges ? <span className="pill">Draft not published</span> : null}
                </strong>
                <span className="note adm-href">/pages/{p.slug}{p.legacy && <> · old address {p.legacy} still works</>}</span>
              </div>
              <div className="act">
                {confirm === p.id ? (
                  <span className="confirm" role="group" aria-label="Delete this page?">
                    <span>Delete this page and its history?</span>
                    <button type="button" className="danger" autoFocus onClick={async () => {
                      const r = await deletePage(p.id); setConfirm(null);
                      setMsg(r.error ? { text: r.error, err: true } : { text: r.ok ?? "" }); router.refresh();
                    }}>Yes, delete</button>
                    <button type="button" onClick={() => setConfirm(null)}>Cancel</button>
                  </span>
                ) : (
                  <>
                    {p.publishedAt && <a href={`/pages/${p.slug}`} target="_blank" rel="noopener">View</a>}
                    <Link href={`/admin/pages/${p.id}`}>Edit</Link>
                    {!p.legacy && <button type="button" onClick={() => setConfirm(p.id)}>Delete</button>}
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="adm-empty">No pages yet.</p>
      )}
    </div>
  );
}
