"use client";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useState } from "react";
import { CATEGORIES, type ImportRow } from "../../../../lib/events";
import { importEvents, previewImport, type PreviewState } from "../actions";
import { fmtDay, fmtTime } from "../manager";
import { Head, SLink, useSchool } from "../../ui";

type Pick = ImportRow & { on: boolean };

export function Importer() {
  const [state, action, pending] = useActionState<PreviewState, FormData>(previewImport, undefined);
  const [rows, setRows] = useState<Pick[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { base } = useSchool();

  useEffect(() => {
    setError(null);
    setRows(state?.rows ? state.rows.map((r) => ({ ...r, on: !r.error && !r.duplicate })) : null);
  }, [state]);

  const chosen = rows?.filter((r) => r.on) ?? [];
  const set = (i: number, patch: Partial<Pick>) => setRows((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const save = async () => {
    setSaving(true);
    setError(null);
    const res = await importEvents(chosen.map(({ title, date, time, endDate, category, note }) => ({ title, date, time, endDate, category, note })));
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    router.push(`${base}/admin/calendar?imported=${res.added ?? 0}&skipped=${res.skipped ?? 0}`);
  };

  return (
    <>
    <Head back={<SLink href="/admin/calendar">← Calendar</SLink>} title="Import events"
      lead="Choose a calendar file (.ics, for example exported from Google Calendar) or a spreadsheet saved as .csv. Nothing is saved until you check the preview and press Import." />
    <div className="adm-card">

      {!rows && (
        <form
          className="adm-f"
          onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}
        >
          {state?.error && <p className="adm-msg adm-msg--err" role="alert">{state.error}</p>}
          <label>
            File
            <span className="hint">
              For .csv, the first row must name the columns: <b>Title</b>, <b>Date</b> (2026-11-19 or 11/19/2026), and optionally
              <b> Time</b> (6:30 PM, empty = all day), <b>Category</b> (No school, Faith, Academic, Community) and <b>Note</b>.
            </span>
            <input type="file" name="file" accept=".ics,.csv,text/calendar,text/csv" required />
          </label>
          <label>
            Category for events that don’t say one
            <select name="default_category" defaultValue="community">
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <span className="hint">Events with words like “No school” or “Mass” get No school or Faith automatically. You can change any of them in the preview.</span>
          </label>
          <div className="adm-actions">
            <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Reading…" : "Preview"}</button>
          </div>
        </form>
      )}

      {rows && (
        <>
          <p className="adm-msg adm-msg--ok" role="status">
            {state?.fileName}: {rows.length} event{rows.length === 1 ? "" : "s"} found.
            {rows.some((r) => r.duplicate) && ` ${rows.filter((r) => r.duplicate).length} already in the calendar (unchecked).`}
            {rows.some((r) => r.error) && ` ${rows.filter((r) => r.error).length} can’t be imported (marked in red).`}
          </p>
          {error && <p className="adm-msg adm-msg--err" role="alert">{error}</p>}
          <div className="adm-tablewrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Import</span>
                    <input type="checkbox" aria-label="Select all"
                      checked={rows.filter((r) => !r.error).every((r) => r.on)}
                      onChange={(e) => setRows(rows.map((r) => ({ ...r, on: !r.error && e.target.checked })))} />
                  </th>
                  <th scope="col">Date</th>
                  <th scope="col">Time</th>
                  <th scope="col">Title</th>
                  <th scope="col">Category</th>
                  <th scope="col">Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.error ? "is-err" : r.duplicate ? "is-dup" : undefined}>
                    <td><input type="checkbox" aria-label={`Import ${r.title}`} checked={r.on} disabled={!!r.error} onChange={(e) => set(i, { on: e.target.checked })} /></td>
                    <td>{r.date ? fmtDay(r.date) : "—"}{r.endDate ? ` – ${fmtDay(r.endDate)}` : ""}</td>
                    <td>{r.date ? fmtTime(r.time) : ""}</td>
                    <td>
                      {r.title || <em>No title</em>}
                      {r.error && <span className="why">{r.error}</span>}
                      {!r.error && r.duplicate && <span className="why why--dup">Already in the calendar</span>}
                      {!r.error && r.repeats && <span className="why why--dup">Repeats in the file: only this date is imported</span>}
                    </td>
                    <td>
                      <select aria-label={`Category for ${r.title}`} value={r.category} disabled={!!r.error} onChange={(e) => set(i, { category: e.target.value })}>
                        {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                    </td>
                    <td className="note">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="adm-actions adm-sticky">
            <button type="button" className="btn btn--primary" onClick={save} disabled={saving || !chosen.length}>
              {saving ? "Importing…" : `Import ${chosen.length} event${chosen.length === 1 ? "" : "s"}`}
            </button>
            <button type="button" className="btn btn--outline" onClick={() => setRows(null)} disabled={saving}>Choose another file</button>
          </div>
        </>
      )}
    </div>
    </>
  );
}
