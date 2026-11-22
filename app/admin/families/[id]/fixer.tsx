"use client";
// The school adds, corrects and removes a family's children.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GRADE_SUGGESTIONS } from "../../../../lib/my-family";
import { removeChild, saveChild, type ChildFix } from "./actions";

export type KidRow = { id: number; name: string; grade: string; teacher: string; factsId: string };

function ChildForm({ familyId, child, onDone }: { familyId: number; child?: KidRow; onDone: (r?: ChildFix) => void }) {
  const router = useRouter();
  const [res, setRes] = useState<ChildFix | null>(null);
  const [pending, start] = useTransition();
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await saveChild(fd);
      if (r.ok) { onDone(r); router.refresh(); return; }
      setRes(r);
      if (r.field) (form.elements.namedItem(r.field) as HTMLElement | null)?.focus();
    });
  };
  const bad = (f: string) => (res?.field === f ? { "aria-invalid": true } : {});
  return (
    <form className="adm-f adm-panel" onSubmit={onSubmit} noValidate>
      <h3 className="my-h3" style={{ margin: 0 }}>{child ? `Edit ${child.name}` : "Add a child"}</h3>
      {res?.error && <p className="adm-msg adm-msg--err" role="alert">{res.error}</p>}
      <input type="hidden" name="family_id" value={familyId} />
      {child && <input type="hidden" name="id" value={child.id} />}
      <label>Name<input type="text" name="name" defaultValue={child?.name} maxLength={100} autoFocus autoComplete="off" {...bad("name")} /></label>
      <div className="adm-row">
        <label>Grade<input type="text" name="grade" defaultValue={child?.grade} maxLength={40} list="grades" placeholder="For example: 3rd grade" {...bad("grade")} /></label>
        <label>Teacher <span className="hint">Optional</span><input type="text" name="teacher" defaultValue={child?.teacher} maxLength={100} autoComplete="off" /></label>
      </div>
      <label>FACTS Student ID <span className="hint">Optional. “Student ID (System)” in FACTS. When set, only the adults FACTS gives access to see this child.</span>
        <input type="text" name="facts_id" defaultValue={child?.factsId} maxLength={64} autoComplete="off" inputMode="numeric" {...bad("facts_id")} /></label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : child ? "Save" : "Add child"}</button>
        <button type="button" className="btn btn--outline" onClick={() => onDone()}>Cancel</button>
      </div>
    </form>
  );
}

export function ChildrenFixer({ familyId, kids }: { familyId: number; kids: KidRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [msg, setMsg] = useState<ChildFix | null>(null);
  const [busy, start] = useTransition();
  const done = (r?: ChildFix) => { setEditing(null); setMsg(r ?? null); };
  const remove = (id: number) => start(async () => { setConfirm(null); setMsg(await removeChild(id)); router.refresh(); });
  return (
    <>
      <datalist id="grades">{GRADE_SUGGESTIONS.map((g) => <option key={g} value={g} />)}</datalist>
      {msg && <p className={`adm-msg ${msg.error ? "adm-msg--err" : "adm-msg--ok"}`} role="status">{msg.error ?? msg.ok}</p>}
      {editing === "new" ? <ChildForm familyId={familyId} onDone={done} /> : (
        <p className="adm-actions" style={{ margin: "12px 0" }}>
          <button type="button" className="btn btn--outline" onClick={() => { setMsg(null); setConfirm(null); setEditing("new"); }} disabled={editing !== null}>Add a child</button>
        </p>
      )}
      {kids.length ? (
        <ul className="adm-list">
          {kids.map((k) => editing === k.id ? (
            <li key={k.id} style={{ listStyle: "none", paddingTop: 12 }}><ChildForm familyId={familyId} child={k} onDone={done} /></li>
          ) : (
            <li key={k.id} className="adm-doc">
              <div className="what">
                <strong>{k.name}</strong>
                <span className="note">{k.grade}{k.teacher && <> · {k.teacher}</>}{k.factsId && <> · FACTS {k.factsId}</>}</span>
              </div>
              <div className="act">
                {confirm === k.id ? (
                  <span className="confirm">
                    <span>Remove {k.name}?</span>
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
      ) : editing !== "new" && <p className="adm-empty">No children yet. The family cannot report absences until you add them.</p>}
    </>
  );
}
