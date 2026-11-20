"use client";
// Forms of "School years" (step 11a).
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState } from "react";
import { addYear, editYear, moveUp, pickYear, saveGrades, switchOn, type YearState } from "./actions";

function useForm(fn: (prev: YearState, fd: FormData) => Promise<YearState>) {
  const [state, action, pending] = useActionState(fn, undefined);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };
  return { state, onSubmit, pending };
}

function Message({ state, id }: { state: YearState; id: string }) {
  if (state?.error) return <p className="adm-msg adm-msg--err" role="alert" id={id}>{state.error}</p>;
  if (state?.ok) return <p className="adm-msg adm-msg--ok" role="status">{state.ok}</p>;
  return null;
}
const bad = (state: YearState, field: string, id: string) => (state?.field === field ? { "aria-invalid": true, "aria-describedby": id } : {});

function DateFields({ state, err, label, startsOn, endsOn }: { state: YearState; err: string; label: string; startsOn: string; endsOn: string }) {
  return (
    <>
      <label>
        Name of the school year
        <span className="hint">For example 2027–28. Families see it on the portal.</span>
        <input type="text" name="label" defaultValue={label} maxLength={30} required {...bad(state, "label", err)} />
      </label>
      <div className="adm-row">
        <label>First day<input type="date" name="starts_on" defaultValue={startsOn} required {...bad(state, "starts_on", err)} /></label>
        <label>Last day<input type="date" name="ends_on" defaultValue={endsOn} required {...bad(state, "ends_on", err)} /></label>
      </div>
    </>
  );
}

export function AddYearForm({ label, startsOn, endsOn, fromLabel }: { label: string; startsOn: string; endsOn: string; fromLabel: string }) {
  const { state, onSubmit, pending } = useForm(addYear);
  const router = useRouter();
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  if (state?.ok) return <Message state={state} id="add-err" />;
  return (
    <form onSubmit={onSubmit} className="adm-f" noValidate>
      <Message state={state} id="add-err" />
      <DateFields state={state} err="add-err" label={label} startsOn={startsOn} endsOn={endsOn} />
      <fieldset {...bad(state, "start", "add-err")}>
        <legend>How to start it</legend>
        <label className="yr-choice">
          <input type="radio" name="start" value="copy" defaultChecked />
          <span>
            <strong>Copy from {fromLabel}</strong>
            <span className="hint">Copies pages, modules, links, staff favorites, contact details, family documents and the look. Never copies the calendar, notices, wishlists or volunteering.</span>
          </span>
        </label>
        <label className="yr-choice">
          <input type="radio" name="start" value="scratch" />
          <span>
            <strong>Start from scratch</strong>
            <span className="hint">An empty year with the basic modules, without logo or colours.</span>
          </span>
        </label>
      </fieldset>
      <p className="note">Families do not see the new year until you switch it on. Families and their accounts stay as they are.</p>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Creating…" : "Create school year"}</button>
      </div>
    </form>
  );
}

export function EditYearForm({ id, label, startsOn, endsOn }: { id: number; label: string; startsOn: string; endsOn: string }) {
  const [open, setOpen] = useState(false);
  const { state, onSubmit, pending } = useForm(editYear);
  const err = `edit-err-${id}`;
  if (!open)
    return <button type="button" className="btn btn--outline btn--sm" onClick={() => setOpen(true)} aria-label={`Edit ${label}`}>Edit</button>;
  return (
    <form onSubmit={onSubmit} className="adm-f yr-edit" noValidate>
      <Message state={state} id={err} />
      <input type="hidden" name="id" value={id} />
      <DateFields state={state} err={err} label={label} startsOn={startsOn} endsOn={endsOn} />
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" className="btn btn--outline" onClick={() => setOpen(false)}>Close</button>
      </div>
    </form>
  );
}

export function OpenYearButton({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  return (
    <form action={(fd) => startTransition(async () => { await pickYear(fd); router.refresh(); })}>
      <input type="hidden" name="year_id" value={id} />
      <button type="submit" className="btn btn--outline btn--sm">Open {label}</button>
    </form>
  );
}

export function SwitchOnForm({ id, label, activeLabel }: { id: number; label: string; activeLabel: string }) {
  const [open, setOpen] = useState(false);
  const { state, onSubmit, pending } = useForm(switchOn);
  const router = useRouter();
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  if (state?.ok) return <Message state={state} id="on-err" />;
  if (!open) return <button type="button" className="btn btn--primary" onClick={() => setOpen(true)}>Switch on {label}…</button>;
  return (
    <form onSubmit={onSubmit} className="adm-f yr-confirm" noValidate>
      <Message state={state} id="on-err" />
      <input type="hidden" name="id" value={id} />
      <p><strong>From now on families will see {label}.</strong> {activeLabel} will be archived: the school can still look at it, families cannot. Grades saved in &ldquo;Move children up a grade&rdquo; become the children&rsquo;s grades.</p>
      <label>
        Type {label} to confirm
        <input type="text" name="confirm" autoComplete="off" required {...bad(state, "confirm", "on-err")} />
      </label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Switching on…" : `Yes, switch on ${label}`}</button>
        <button type="button" className="btn btn--outline" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}

export function GradesForm({ grades }: { grades: string[] }) {
  const { state, onSubmit, pending } = useForm(saveGrades);
  return (
    <form onSubmit={onSubmit} className="adm-f" noValidate>
      <Message state={state} id="grades-err" />
      <label>
        Grades, from youngest to oldest
        <span className="hint">One per line. After the last one, children leave the school.</span>
        <textarea name="grades" rows={Math.max(6, grades.length + 1)} defaultValue={grades.join("\n")} {...bad(state, "grades", "grades-err")} />
      </label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : "Save grades"}</button>
      </div>
    </form>
  );
}

export type PromoRow = { id: number; name: string; family: string; grade: string; proposed: string; review: boolean };

export function MoveUpForm({ yearId, rows, grades, leaves, applyNow }: { yearId: number; rows: PromoRow[]; grades: string[]; leaves: string; applyNow: boolean }) {
  const { state, onSubmit, pending } = useForm(moveUp);
  const toReview = rows.filter((r) => r.review).length;
  return (
    <form onSubmit={onSubmit} className="adm-f" noValidate>
      <Message state={state} id="move-err" />
      <input type="hidden" name="year_id" value={yearId} />
      {toReview > 0 && (
        <p className="adm-msg adm-msg--warn" role="note">
          {toReview} {toReview === 1 ? "child has a grade" : "children have a grade"} that is not in the school&rsquo;s list of grades. Choose the new grade by hand (marked &ldquo;Check&rdquo;).
        </p>
      )}
      <div className="adm-tablewrap">
        <table className="adm-table yr-table">
          <thead>
            <tr><th scope="col">Child</th><th scope="col">Family</th><th scope="col">Grade now</th><th scope="col">New grade</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.review ? "is-review" : undefined}>
                <th scope="row">{r.name}<input type="hidden" name="child" value={r.id} /></th>
                <td>{r.family}</td>
                <td>{r.grade || <span className="note">None</span>}{r.review && <span className="pill pill--warn">Check</span>}</td>
                <td>
                  <select name={`grade_${r.id}`} defaultValue={r.proposed} aria-label={`New grade for ${r.name}`}>
                    {!r.proposed && <option value="">Choose…</option>}
                    {r.review && r.grade && !grades.includes(r.grade) && <option value={r.grade}>{r.grade} (same)</option>}
                    {grades.map((g) => <option key={g} value={g}>{g}</option>)}
                    <option value={leaves}>Leaves the school</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">{applyNow ? "This year is already active: the new grades apply as soon as you save." : "The new grades apply when you switch the year on. Until then families keep seeing the current ones."} Children who leave the school stay on record, but are no longer listed.</p>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : "Save new grades"}</button>
      </div>
    </form>
  );
}
