"use client";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { ACCEPT_ATTR, MAX_FILE_BYTES } from "../../../lib/files";
import {
  deleteCategory, deleteDocument, moveCategory, moveDocument, saveCategory, saveDocument, startUpload, type DocState,
} from "./actions";

export type AdminCategory = { id: number; key: string; name: string; description: string };
export type AdminDoc = {
  id: number; categoryId: number; title: string; description: string; href: string; meta: string; kind: string;
  mostUsed: boolean; uploaded: boolean; fileName: string | null;
};

type Msg = { text: string; err?: boolean } | null;

// ---------------------------------------------------------------- forms ----

function CategoryForm({ cat, onDone }: { cat: AdminCategory | null; onDone: (msg: string) => void }) {
  const [state, action, pending] = useActionState<DocState, FormData>(saveCategory, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: "nearest" }); ref.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus(); }, []);
  useEffect(() => { if (state?.ok) onDone(state.ok); }, [state, onDone]);
  return (
    <form ref={ref} className="adm-f adm-panel" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}>
      <h2>{cat ? "Rename category" : "New category"}</h2>
      {state?.error && <p className="adm-msg adm-msg--err" role="alert">{state.error}</p>}
      {cat && <input type="hidden" name="id" value={cat.id} />}
      <label>
        Name
        <input type="text" name="name" maxLength={60} required defaultValue={cat?.name ?? ""} />
      </label>
      <label>
        Description (optional)
        <span className="hint">Shown under the name on the portal.</span>
        <input type="text" name="description" maxLength={160} defaultValue={cat?.description ?? ""} />
      </label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" className="btn btn--outline" onClick={() => onDone("")}>Cancel</button>
      </div>
    </form>
  );
}

function DocumentForm({ doc, categories, defaultCategory, storageReady, onDone }: {
  doc: AdminDoc | null; categories: AdminCategory[]; defaultCategory?: number; storageReady: boolean; onDone: (msg: string) => void;
}) {
  const [state, action, pending] = useActionState<DocState, FormData>(saveDocument, undefined);
  const [source, setSource] = useState<"file" | "link">(doc ? (doc.kind === "file" ? "file" : "link") : storageReady ? "file" : "link");
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: "nearest" }); ref.current?.querySelector<HTMLInputElement>("input[name=title]")?.focus(); }, []);
  useEffect(() => { if (state?.ok) onDone(state.ok); }, [state, onDone]);
  useEffect(() => { if (state?.error) setError(state.error); }, [state]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    fd.delete("file");
    if (source === "file" && file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) { setError("The file is larger than 25 MB."); return; }
      setUploading("Uploading the file…");
      const t = await startUpload(file.name, file.size);
      if ("error" in t) { setUploading(null); setError(t.error); return; }
      try {
        const res = await fetch(t.putUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setUploading(null);
        setError("The file could not be sent to storage. Check your connection and try again. If it keeps failing, the storage still needs its upload (CORS) setting.");
        return;
      }
      setUploading(null);
      fd.set("upload_token", t.token);
    }
    startTransition(() => action(fd));
  };

  const busy = pending || !!uploading;
  const currentFile = doc && doc.kind === "file" ? (doc.fileName ?? doc.href.split("/").pop()) : null;
  return (
    <form ref={ref} className="adm-f adm-panel" onSubmit={submit}>
      <h2>{doc ? "Edit document" : "New document"}</h2>
      {error && <p className="adm-msg adm-msg--err" role="alert">{error}</p>}
      {doc && <input type="hidden" name="id" value={doc.id} />}
      <label>
        Title
        <input type="text" name="title" maxLength={150} required defaultValue={doc?.title ?? ""} />
      </label>
      <label>
        Category
        <select name="category_id" required defaultValue={doc?.categoryId ?? defaultCategory ?? ""}>
          <option value="" disabled>Choose…</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label>
        Short description (optional)
        <span className="hint">Shown next to the document, for example “Due Sept 4”. Up to 80 characters.</span>
        <input type="text" name="description" maxLength={80} defaultValue={doc?.description ?? ""} />
      </label>
      <fieldset>
        <legend>The document is</legend>
        <div className="adm-radios">
          <label className="adm-check"><input type="radio" name="source" value="file" checked={source === "file"} onChange={() => setSource("file")} /> A file</label>
          <label className="adm-check"><input type="radio" name="source" value="link" checked={source === "link"} onChange={() => setSource("link")} /> A link</label>
        </div>
        {source === "file" ? (
          <label>
            {currentFile ? "Replace the file (optional)" : "File"}
            <span className="hint">
              PDF, Word or image, up to 25 MB.{currentFile && <> Current file: <b>{currentFile}</b>.</>}
            </span>
            {!storageReady && <span className="adm-msg adm-msg--err">File uploads are not set up yet. Use a link for now.</span>}
            <input type="file" name="file" accept={ACCEPT_ATTR} required={!currentFile} disabled={!storageReady} />
          </label>
        ) : (
          <label>
            Link
            <span className="hint">For example a Google Drive share link. It opens in a new tab.</span>
            <input type="text" name="link" inputMode="url" maxLength={1000} required placeholder="https://"
              defaultValue={doc && doc.kind !== "file" ? doc.href : ""} />
          </label>
        )}
      </fieldset>
      <label className="adm-check">
        <input type="checkbox" name="most_used" defaultChecked={doc?.mostUsed ?? false} />
        Show in “Most used”
      </label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>{uploading ?? (pending ? "Saving…" : "Save")}</button>
        <button type="button" className="btn btn--outline" onClick={() => onDone("")} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ rows ----

function Confirm({ label, onYes, onNo }: { label: string; onYes: () => Promise<void>; onNo: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <span className="confirm" role="group" aria-label={label}>
      <span>{label}</span>
      <button type="button" className="danger" autoFocus disabled={busy} onClick={async () => { setBusy(true); await onYes(); setBusy(false); }}>
        {busy ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" onClick={onNo} disabled={busy}>Cancel</button>
    </span>
  );
}

function DocRow({ d, first, last, onEdit, report }: { d: AdminDoc; first: boolean; last: boolean; onEdit: () => void; report: (r: DocState) => void }) {
  const [confirming, setConfirming] = useState(false);
  const move = async (dir: -1 | 1) => report(await moveDocument(d.id, dir));
  return (
    <li className="adm-doc">
      <div className="what">
        <strong>{d.title}</strong>
        <span className="note">
          {[d.description, d.meta].filter(Boolean).join(" · ")}
          {d.mostUsed && <span className="pill">Most used</span>}
        </span>
      </div>
      <div className="act">
        {confirming ? (
          <Confirm label="Delete this document?" onNo={() => setConfirming(false)}
            onYes={async () => { const r = await deleteDocument(d.id); setConfirming(false); report(r); }} />
        ) : (
          <>
            <a href={d.href.startsWith("http") ? d.href : `/${d.href}`} target="_blank" rel="noopener">Open</a>
            <button type="button" onClick={() => move(-1)} disabled={first} aria-label={`Move ${d.title} up`}>↑</button>
            <button type="button" onClick={() => move(1)} disabled={last} aria-label={`Move ${d.title} down`}>↓</button>
            <button type="button" onClick={onEdit}>Edit</button>
            <button type="button" onClick={() => setConfirming(true)}>Delete</button>
          </>
        )}
      </div>
    </li>
  );
}

// --------------------------------------------------------------- manager ----

type Editing =
  | { type: "doc"; doc: AdminDoc | null; category?: number }
  | { type: "cat"; cat: AdminCategory | null }
  | null;

export function DocumentsManager({ categories, docs, storageReady }: { categories: AdminCategory[]; docs: AdminDoc[]; storageReady: boolean }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [confirmCat, setConfirmCat] = useState<number | null>(null);
  const router = useRouter();

  const report = (r: DocState) => {
    if (r?.error) setMsg({ text: r.error, err: true });
    else if (r?.ok) { setMsg({ text: r.ok }); router.refresh(); }
  };
  const done = (text: string) => { setEditing(null); if (text) { setMsg({ text }); router.refresh(); } };
  const open = (e: Editing) => { setMsg(null); setEditing(e); };

  return (
    <div className="adm-card">
      <div className="adm-head">
        <div>
          <h1>Documents</h1>
          <p className="lead">The “Family documents” section of the portal, in this order.</p>
        </div>
        <div className="adm-actions">
          <button type="button" className="btn btn--primary" onClick={() => open({ type: "doc", doc: null })}>Add document</button>
          <button type="button" className="btn btn--outline" onClick={() => open({ type: "cat", cat: null })}>Add category</button>
        </div>
      </div>
      {msg && <p className={`adm-msg ${msg.err ? "adm-msg--err" : "adm-msg--ok"}`} role="status">{msg.text}</p>}
      {editing?.type === "doc" && (
        <DocumentForm key={editing.doc?.id ?? "new"} doc={editing.doc} categories={categories} defaultCategory={editing.category}
          storageReady={storageReady} onDone={done} />
      )}
      {editing?.type === "cat" && <CategoryForm key={editing.cat?.id ?? "new"} cat={editing.cat} onDone={done} />}

      {categories.map((c, ci) => {
        const items = docs.filter((d) => d.categoryId === c.id);
        return (
          <section key={c.id} className="adm-cat" aria-labelledby={`c-${c.id}`}>
            <div className="adm-cat-top">
              <div>
                <h2 id={`c-${c.id}`}>{c.name} <span className="count">{items.length}</span></h2>
                {c.description && <p className="note">{c.description}</p>}
              </div>
              <div className="act">
                {confirmCat === c.id ? (
                  <Confirm label="Delete this category?" onNo={() => setConfirmCat(null)}
                    onYes={async () => { const r = await deleteCategory(c.id); setConfirmCat(null); report(r); }} />
                ) : (
                  <>
                    <button type="button" onClick={async () => report(await moveCategory(c.id, -1))} disabled={ci === 0} aria-label={`Move ${c.name} up`}>↑</button>
                    <button type="button" onClick={async () => report(await moveCategory(c.id, 1))} disabled={ci === categories.length - 1} aria-label={`Move ${c.name} down`}>↓</button>
                    <button type="button" onClick={() => open({ type: "cat", cat: c })}>Rename</button>
                    {!items.length && <button type="button" onClick={() => setConfirmCat(c.id)}>Delete</button>}
                    <button type="button" onClick={() => open({ type: "doc", doc: null, category: c.id })}>Add here</button>
                  </>
                )}
              </div>
            </div>
            {items.length ? (
              <ul className="adm-list">
                {items.map((d, i) => (
                  <DocRow key={d.id} d={d} first={i === 0} last={i === items.length - 1} report={report}
                    onEdit={() => open({ type: "doc", doc: d })} />
                ))}
              </ul>
            ) : (
              <p className="adm-empty">No documents yet. Empty categories are not shown on the portal.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}
