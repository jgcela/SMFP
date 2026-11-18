"use client";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { checkHref } from "../../../../lib/links";
import { publishPage, restoreVersion, saveDraft, startImageUpload, type PageCopy, type PageResult } from "../actions";

export type EditorPage = {
  id: number; slug: string; legacy: string; title: string; summary: string; html: string;
  publishedAt: string | null; unpublishedChanges: boolean;
};
export type Version = { id: number; kind: "draft" | "published" | "imported" | "restored"; title: string; author: string; createdAt: string };

const KIND: Record<Version["kind"], string> = { draft: "Draft saved", published: "Published", imported: "Imported", restored: "Restored" };
const when = (iso: string) =>
  new Date(iso.replace(" ", "T").replace(/(\+\d\d)$/, "$1:00")).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function checkLink(v: string): string | null {
  const href = v.trim();
  if (/^(mailto:[^\s@]+@[^\s@]+\.[a-z]{2,}|tel:\+?[\d\s().-]{7,})$/i.test(href)) return null;
  return checkHref(href, [], []);
}

// ---------------------------------------------------------------- toolbar ----

function Btn({ on, active, label, children, disabled }: { on: () => void; active?: boolean; label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className="pe-btn" aria-pressed={active} aria-label={label} title={label} disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} onClick={on}>{children}</button>
  );
}

function Toolbar({ editor, onImage, onLink }: { editor: Editor; onImage: () => void; onLink: () => void }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : e.isActive("heading", { level: 4 }) ? "h4" : e.isActive("heading", { level: 5 }) ? "h5" : "p",
      bold: e.isActive("bold"), italic: e.isActive("italic"), underline: e.isActive("underline"),
      bullet: e.isActive("bulletList"), ordered: e.isActive("orderedList"), task: e.isActive("taskList"),
      link: e.isActive("link"), table: e.isActive("table"),
      undo: e.can().undo(), redo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();
  return (
    <div className="pe-toolbar" role="toolbar" aria-label="Formatting">
      <select aria-label="Text style" value={s.block} onChange={(e) => {
        const v = e.target.value;
        if (v === "p") c().setParagraph().run(); else c().setHeading({ level: Number(v[1]) as 2 | 3 | 4 | 5 }).run();
      }}>
        <option value="p">Normal text</option>
        <option value="h2">Title 1 (section)</option>
        <option value="h3">Title 2</option>
        <option value="h4">Title 3</option>
        <option value="h5">Title 4</option>
      </select>
      <span className="pe-sep" />
      <Btn label="Bold" active={s.bold} on={() => c().toggleBold().run()}><b>B</b></Btn>
      <Btn label="Italic" active={s.italic} on={() => c().toggleItalic().run()}><i>I</i></Btn>
      <Btn label="Underline" active={s.underline} on={() => c().toggleUnderline().run()}><u>U</u></Btn>
      <span className="pe-sep" />
      <Btn label="Bulleted list" active={s.bullet} on={() => c().toggleBulletList().run()}>• List</Btn>
      <Btn label="Numbered list" active={s.ordered} on={() => c().toggleOrderedList().run()}>1. List</Btn>
      <Btn label="Checklist (families can tick items)" active={s.task} on={() => c().toggleTaskList().run()}>☑ Checklist</Btn>
      <span className="pe-sep" />
      <Btn label="Link" active={s.link} on={onLink}>Link</Btn>
      <Btn label="Insert table" active={s.table} on={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Table</Btn>
      <Btn label="Insert image" on={onImage}>Image</Btn>
      <span className="pe-sep" />
      <Btn label="Undo" disabled={!s.undo} on={() => c().undo().run()}>↶</Btn>
      <Btn label="Redo" disabled={!s.redo} on={() => c().redo().run()}>↷</Btn>
      {s.table && (
        <div className="pe-tablebar" role="group" aria-label="Table">
          <span>Table:</span>
          <Btn label="Add row below" on={() => c().addRowAfter().run()}>+ Row</Btn>
          <Btn label="Add column right" on={() => c().addColumnAfter().run()}>+ Column</Btn>
          <Btn label="Delete row" on={() => c().deleteRow().run()}>− Row</Btn>
          <Btn label="Delete column" on={() => c().deleteColumn().run()}>− Column</Btn>
          <Btn label="Header row on or off" on={() => c().toggleHeaderRow().run()}>Header row</Btn>
          <Btn label="Delete table" on={() => c().deleteTable().run()}>Delete table</Btn>
        </div>
      )}
    </div>
  );
}

function LinkBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const current = (editor.getAttributes("link").href as string | undefined) ?? "";
  const [href, setHref] = useState(current);
  const [newTab, setNewTab] = useState(editor.getAttributes("link").target === "_blank" || (!current && false));
  const [warn, setWarn] = useState<string | null>(null);
  const apply = () => {
    const problem = checkLink(href);
    setWarn(problem);
    if (problem) return;
    const chain = editor.chain().focus().extendMarkRange("link");
    const attrs = { href: href.trim(), target: newTab ? "_blank" : null };
    if (editor.state.selection.empty && !current) chain.insertContent({ type: "text", text: href.trim(), marks: [{ type: "link", attrs }] }).run();
    else chain.setLink(attrs as { href: string; target?: string | null }).run();
    onClose();
  };
  return (
    <div className="pe-linkbar adm-f" role="group" aria-label="Link">
      <label>
        Link address
        <span className="hint">https://…, an email as mailto:name@school.org, or a portal page like pages/supply-list.</span>
        <input type="text" inputMode="url" autoFocus value={href} placeholder="https://" aria-invalid={!!warn}
          onChange={(e) => { setHref(e.target.value); if (warn) setWarn(checkLink(e.target.value)); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); apply(); } if (e.key === "Escape") onClose(); }} />
        {warn && <span className="adm-msg adm-msg--err" role="alert">{warn}</span>}
      </label>
      <label className="adm-check"><input type="checkbox" checked={newTab} onChange={(e) => setNewTab(e.target.checked)} /> Open in a new tab</label>
      <div className="adm-actions">
        <button type="button" className="btn btn--primary" onClick={apply}>Apply link</button>
        {current && <button type="button" className="btn btn--outline" onClick={() => { editor.chain().focus().extendMarkRange("link").unsetLink().run(); onClose(); }}>Remove link</button>}
        <button type="button" className="btn btn--outline" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- editor ----

export function PageEditor({ page, versions }: { page: EditorPage; versions: Version[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(page.title);
  const [summary, setSummary] = useState(page.summary);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [linking, setLinking] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<number | null>(null);
  const [published, setPublished] = useState({ at: page.publishedAt, pending: page.unpublishedChanges });
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4, 5] },
        code: false, codeBlock: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: "https", HTMLAttributes: { rel: null, target: null } },
      }),
      // Keeps the size class of imported logos and icons (hb-logo, hb-icon).
      Image.extend({ addAttributes() { return { ...this.parent?.(), class: { default: null } }; } }),
      TableKit.configure({ table: { resizable: false } }),
      TaskList, TaskItem.configure({ nested: true }),
    ],
    content: page.html,
    editorProps: { attributes: { class: "pe-content", "aria-label": "Page text" } },
    onUpdate: () => setDirty(true),
  });

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); } };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [dirty]);

  const copy = (): PageCopy => ({ title, summary, html: editor?.getHTML() ?? "" });
  const after = (r: PageResult, kind: "save" | "publish" | "restore") => {
    setBusy(null);
    if (r.error) { setMsg({ text: r.error, err: true }); return; }
    setMsg({ text: r.ok ?? "" });
    setDirty(false);
    if (kind === "publish") setPublished({ at: r.savedAt ?? new Date().toISOString(), pending: false });
    else setPublished((p) => ({ ...p, pending: !!p.at }));
    if (kind === "restore" && r.copy && editor) {
      setTitle(r.copy.title); setSummary(r.copy.summary);
      editor.commands.setContent(r.copy.html, { emitUpdate: false });
    }
    router.refresh();
  };
  const save = async () => { setBusy("Saving…"); after(await saveDraft(page.id, copy()), "save"); };
  const publish = async () => { setBusy("Publishing…"); after(await publishPage(page.id, copy()), "publish"); };
  const restore = async (v: number) => { setConfirmRestore(null); setBusy("Restoring…"); after(await restoreVersion(page.id, v), "restore"); };
  const preview = async () => {
    if (dirty) { setBusy("Saving…"); const r = await saveDraft(page.id, copy()); after(r, "save"); if (r.error) return; }
    window.open(`/admin/pages/${page.id}/preview`, "_blank", "noopener");
  };

  const addImage = async (file: File) => {
    if (!editor) return;
    setBusy("Uploading the image…");
    const t = await startImageUpload(file.name, file.size);
    if ("error" in t) { setBusy(null); setMsg({ text: t.error, err: true }); return; }
    try {
      const res = await fetch(t.putUrl, { method: "PUT", body: file, headers: { "Content-Type": t.contentType } });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setBusy(null);
      setMsg({ text: "The image could not be sent to storage. Check your connection and try again. If it keeps failing, the storage still needs its upload (CORS) setting.", err: true });
      return;
    }
    setBusy(null);
    const alt = file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ");
    editor.chain().focus().setImage({ src: t.src, alt }).run();
  };

  const status = !published.at ? "Not published yet. Families cannot see this page."
    : published.pending || dirty ? "Families see the last published version. Your changes are not published yet."
    : "Published. Families see exactly this version.";

  return (
    <div className="pe">
      <div className="pe-main adm-card">
        <p className="pe-crumbs"><Link href="/admin/pages">← All pages</Link></p>
        <div className="adm-f">
          <label>
            Page title
            <input type="text" maxLength={120} value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} />
          </label>
          <label>
            Short summary (optional)
            <span className="hint">Shown under the title.</span>
            <input type="text" maxLength={300} value={summary} onChange={(e) => { setSummary(e.target.value); setDirty(true); }} />
          </label>
        </div>
        {editor && <Toolbar editor={editor} onImage={() => fileRef.current?.click()} onLink={() => setLinking(true)} />}
        {editor && linking && <LinkBar editor={editor} onClose={() => setLinking(false)} />}
        <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.gif,.webp" hidden
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) addImage(f); }} />
        <div className="pe-paper">
          {editor ? <EditorContent editor={editor} /> : <p className="adm-empty">Loading the editor…</p>}
        </div>
      </div>

      <aside className="pe-side">
        <div className="adm-card pe-actions">
          <p className={`pe-status${published.pending || dirty || !published.at ? " is-pending" : ""}`} role="status">{status}</p>
          {msg && <p className={`adm-msg ${msg.err ? "adm-msg--err" : "adm-msg--ok"}`} role="alert">{msg.text}</p>}
          <button type="button" className="btn btn--outline" onClick={save} disabled={!!busy || !editor}>{busy === "Saving…" ? busy : "Save draft"}</button>
          <button type="button" className="btn btn--outline" onClick={preview} disabled={!!busy || !editor}>Preview draft</button>
          <button type="button" className="btn btn--primary" onClick={publish} disabled={!!busy || !editor}>{busy === "Publishing…" ? busy : "Publish"}</button>
          {busy && !["Saving…", "Publishing…"].includes(busy) && <p className="note">{busy}</p>}
          <p className="note">Address: {published.at ? <a href={`/pages/${page.slug}`} target="_blank" rel="noopener">/pages/{page.slug}</a> : `/pages/${page.slug}`}
            {page.legacy && <> · the old address {page.legacy} leads here</>}</p>
        </div>
        <div className="adm-card pe-versions">
          <h2>History</h2>
          <p className="note">Every saved draft and every publish. “Restore” puts that version back in the draft.</p>
          <ol>
            {versions.map((v) => (
              <li key={v.id}>
                <div>
                  <strong>{KIND[v.kind]}</strong> <span className="note">{when(v.createdAt)}</span>
                  {v.author && <div className="note">{v.author}</div>}
                </div>
                {confirmRestore === v.id ? (
                  <span className="confirm">
                    <span>{dirty ? "Replace your unsaved changes?" : "Restore this version?"}</span>
                    <button type="button" className="danger" onClick={() => restore(v.id)}>Yes, restore</button>
                    <button type="button" onClick={() => setConfirmRestore(null)}>Cancel</button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirmRestore(v.id)} disabled={!!busy}>Restore</button>
                )}
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}
