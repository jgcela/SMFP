"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { CATEGORIES, CATEGORY_LABEL } from "../../../lib/events";
import { deleteEvent, saveEvent, type EventState } from "./actions";

export type AdminEvent = { id: number; date: string; endDate: string | null; time: string | null; category: string; title: string; note: string };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DOW[dt.getDay()]}, ${MON[m - 1]} ${d}, ${y}`;
}
export function fmtTime(t: string | null) {
  if (!t) return "All day";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

function EventForm({ event, onDone }: { event: AdminEvent | null; onDone: (msg: string) => void }) {
  const [state, action, pending] = useActionState<EventState, FormData>(saveEvent, undefined);
  const [allDay, setAllDay] = useState(event ? !event.time : true);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { ref.current?.scrollIntoView({ block: "nearest" }); ref.current?.querySelector<HTMLInputElement>("input[name=title]")?.focus(); }, []);
  useEffect(() => { if (state?.ok) onDone(state.ok); }, [state, onDone]);
  const cats = CATEGORIES.map((c) => ({ key: c.key as string, label: c.label as string }));
  if (event && !cats.some((c) => c.key === event.category)) cats.push({ key: event.category, label: CATEGORY_LABEL[event.category] ?? event.category });
  return (
    <form
      ref={ref}
      className="adm-f adm-panel"
      onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); startTransition(() => action(fd)); }}
    >
      <h2>{event ? "Edit event" : "New event"}</h2>
      {state?.error && <p className="adm-msg adm-msg--err" role="alert">{state.error}</p>}
      {event && <input type="hidden" name="id" value={event.id} />}
      <label>
        Title
        <input type="text" name="title" maxLength={150} required defaultValue={event?.title ?? ""} />
      </label>
      <div className="adm-row">
        <label>
          Date
          <input type="date" name="date" required defaultValue={event?.date ?? ""} />
        </label>
        <label>
          Time
          <input type="time" name="time" disabled={allDay} required={!allDay} defaultValue={event?.time ?? ""} />
        </label>
      </div>
      {event?.endDate && <p className="hint">This event lasts until {fmtDay(event.endDate)}. Changing the date makes it a one-day event.</p>}
      <label className="adm-check">
        <input type="checkbox" name="all_day" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
        All day
      </label>
      <label>
        Category
        <select name="category" required defaultValue={event?.category ?? ""}>
          <option value="" disabled>Choose…</option>
          {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </label>
      <label>
        Note (optional)
        <span className="hint">Shown under the title, for example the place.</span>
        <input type="text" name="note" maxLength={500} defaultValue={event?.note ?? ""} />
      </label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" className="btn btn--outline" onClick={() => onDone("")}>Cancel</button>
      </div>
    </form>
  );
}

function Row({ e, past, onEdit, onDeleted }: { e: AdminEvent; past: boolean; onEdit: () => void; onDeleted: (msg: string, err?: boolean) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const del = async () => {
    setBusy(true);
    const r = await deleteEvent(e.id);
    setBusy(false);
    setConfirming(false);
    onDeleted(r?.error ?? r?.ok ?? "", !!r?.error);
  };
  return (
    <li className={`adm-ev${past ? " is-past" : ""}`}>
      <div className="when">
        <span className="d">{fmtDay(e.date)}{e.endDate ? ` – ${fmtDay(e.endDate)}` : ""}</span>
        <span className="t">{fmtTime(e.time)}</span>
      </div>
      <div className="what">
        <span className={`cat cat--${e.category}`}>{CATEGORY_LABEL[e.category] ?? e.category}</span>
        <strong>{e.title}</strong>
        {e.note && <span className="note">{e.note}</span>}
      </div>
      <div className="act">
        {confirming ? (
          <span className="confirm" role="group" aria-label="Confirm delete">
            <span>Delete this event?</span>
            <button type="button" className="danger" onClick={del} disabled={busy} autoFocus>{busy ? "Deleting…" : "Yes, delete"}</button>
            <button type="button" onClick={() => setConfirming(false)} disabled={busy}>Cancel</button>
          </span>
        ) : (
          <>
            <button type="button" onClick={onEdit}>Edit</button>
            <button type="button" onClick={() => setConfirming(true)}>Delete</button>
          </>
        )}
      </div>
    </li>
  );
}

export function CalendarManager({ events, notice }: { events: AdminEvent[]; notice?: string }) {
  const [q, setQ] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [editing, setEditing] = useState<AdminEvent | "new" | null>(null);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(notice ? { text: notice } : null);
  const [gone, setGone] = useState<Set<number>>(new Set());
  const router = useRouter();
  const t = today();

  const list = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return events.filter((e) => {
      if (gone.has(e.id)) return false;
      if (!showPast && !words.length && (e.endDate ?? e.date) < t) return false;
      const hay = `${e.title} ${e.note} ${CATEGORY_LABEL[e.category] ?? ""} ${fmtDay(e.date)} ${e.date}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [events, q, showPast, t, gone]);
  const pastCount = events.filter((e) => (e.endDate ?? e.date) < t).length;

  const done = (text: string) => { setEditing(null); if (text) { setMsg({ text }); router.refresh(); } };

  return (
    <div className="adm-card">
      <div className="adm-head">
        <div>
          <h1>Calendar</h1>
          <p className="lead">These events appear in “This week and next”, the month view and the no-school notice of the portal.</p>
        </div>
        <div className="adm-actions">
          <button type="button" className="btn btn--primary" onClick={() => { setMsg(null); setEditing("new"); }}>Add event</button>
          <Link href="/admin/calendar/import" className="btn btn--outline">Import .ics / .csv</Link>
        </div>
      </div>
      {msg && <p className={`adm-msg ${msg.err ? "adm-msg--err" : "adm-msg--ok"}`} role="status">{msg.text}</p>}
      {editing && <EventForm key={editing === "new" ? "new" : editing.id} event={editing === "new" ? null : editing} onDone={done} />}
      <div className="adm-tools">
        <label className="adm-search">
          <span className="sr-only">Search events</span>
          <input type="search" placeholder="Search by title, note, category or date" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="adm-check">
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          Show past events ({pastCount})
        </label>
      </div>
      <p className="adm-count" aria-live="polite">{list.length} event{list.length === 1 ? "" : "s"}{q ? ` matching “${q}”` : ""}</p>
      <ul className="adm-list">
        {list.map((e) => (
          <Row key={e.id} e={e} past={(e.endDate ?? e.date) < t}
            onEdit={() => { setMsg(null); setEditing(e); }}
            onDeleted={(text, err) => {
              setMsg({ text, err });
              if (!err) { setGone((g) => new Set(g).add(e.id)); router.refresh(); }
            }} />
        ))}
      </ul>
      {!list.length && <p className="adm-empty">{q ? "No events match your search." : "No upcoming events."}</p>}
    </div>
  );
}
