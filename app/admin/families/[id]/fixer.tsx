"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { GRADE_SUGGESTIONS } from "../../../../lib/my-family";
import { correctChild, type ChildFix } from "./actions";

export type KidRow = { id: number; name: string; grade: string; teacher: string; updatedBy: string };

export function ChildrenFixer({ kids }: { kids: KidRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | null>(null);
  const [res, setRes] = useState<ChildFix | null>(null);
  const [pending, start] = useTransition();
  if (!kids.length) return <p className="adm-empty">This family has not added any children yet.</p>;
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await correctChild(fd);
      setRes(r);
      if (r.ok) { setEditing(null); router.refresh(); }
      else if (r.field) (form.elements.namedItem(r.field) as HTMLElement | null)?.focus();
    });
  };
  return (
    <>
      <datalist id="grades">{GRADE_SUGGESTIONS.map((g) => <option key={g} value={g} />)}</datalist>
      {res && editing === null && <p className={`adm-msg ${res.error ? "adm-msg--err" : "adm-msg--ok"}`} role="status">{res.error ?? res.ok}</p>}
      <ul className="adm-list">
        {kids.map((k) => editing === k.id ? (
          <li key={k.id} style={{ listStyle: "none", paddingTop: 12 }}>
            <form className="adm-f adm-panel" onSubmit={onSubmit} noValidate>
              {res?.error && <p className="adm-msg adm-msg--err" role="alert">{res.error}</p>}
              <input type="hidden" name="id" value={k.id} />
              <label>Name<input type="text" name="name" defaultValue={k.name} maxLength={100} autoFocus autoComplete="off" /></label>
              <div className="adm-row">
                <label>Grade<input type="text" name="grade" defaultValue={k.grade} maxLength={40} list="grades" /></label>
                <label>Teacher<input type="text" name="teacher" defaultValue={k.teacher} maxLength={100} autoComplete="off" /></label>
              </div>
              <div className="adm-actions">
                <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
                <button type="button" className="btn btn--outline" onClick={() => { setEditing(null); setRes(null); }}>Cancel</button>
              </div>
            </form>
          </li>
        ) : (
          <li key={k.id} className="adm-doc">
            <div className="what">
              <strong>{k.name}</strong>
              <span className="note">{k.grade}{k.teacher && <> · {k.teacher}</>}{k.updatedBy !== "family" && k.updatedBy && <> · corrected by {k.updatedBy}</>}</span>
            </div>
            <div className="act"><button type="button" onClick={() => { setRes(null); setEditing(k.id); }} disabled={editing !== null}>Correct</button></div>
          </li>
        ))}
      </ul>
    </>
  );
}
