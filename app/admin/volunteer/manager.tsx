"use client";
// Staff: the school's volunteer opportunities. Create, edit, hide, delete (with a
// confirmation), and see who signed up.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { KINDS, spotsLabel, whenLabel, type Opportunity } from "../../../lib/volunteer";
import { deleteOpportunity, saveOpportunity, setOpportunityHidden, type VolResult } from "./actions";
import { Badge, Head, PencilIcon, RowMenu, SLink } from "../ui";

const LINK_ROWS = 4;

function OppForm({ o, onDone }: { o?: Opportunity; onDone: (r?: VolResult) => void }) {
  const router = useRouter();
  const [res, setRes] = useState<VolResult | null>(null);
  const [pending, start] = useTransition();
  const [hasDate, setHasDate] = useState(o ? !!o.eventDate : true);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (!hasDate) { fd.delete("event_date"); fd.delete("start_time"); fd.delete("end_time"); } else fd.delete("when_text");
    start(async () => {
      const r = await saveOpportunity(fd);
      if (r.ok) { onDone(r); router.refresh(); return; }
      setRes(r);
      if (r.field) (form.elements.namedItem(r.field) as HTMLElement | null)?.focus();
    });
  };
  const bad = (f: string) => (res?.field === f ? { "aria-invalid": true } : {});
  const links = [...(o?.links ?? [])];
  return (
    <form className="adm-f adm-panel" onSubmit={onSubmit} noValidate>
      <h2>{o ? `Edit “${o.title}”` : "New opportunity"}</h2>
      {res?.error && <p className="adm-msg adm-msg--err" role="alert">{res.error}</p>}
      {o && <input type="hidden" name="id" value={o.id} />}
      <label>Title<input type="text" name="title" defaultValue={o?.title} maxLength={200} autoFocus {...bad("title")} /></label>
      <label>Description<textarea name="description" defaultValue={o?.description} rows={4} maxLength={3000} /></label>
      <div className="adm-row">
        <label>Type
          <select name="kind" defaultValue={o?.kind ?? "events"} {...bad("kind")}>
            {Object.entries(KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <span className="hint">The filter it appears under on the Volunteer page.</span>
        </label>
        <label>Label on the card <span className="hint">Optional, for example: Community &amp; Events</span><input type="text" name="area" defaultValue={o?.area} maxLength={60} /></label>
      </div>
      <fieldset>
        <legend>Date and time</legend>
        <div className="adm-radios">
          <label className="adm-check"><input type="radio" name="has_date" checked={hasDate} onChange={() => setHasDate(true)} />One date</label>
          <label className="adm-check"><input type="radio" name="has_date" checked={!hasDate} onChange={() => setHasDate(false)} />Repeats or no fixed date</label>
        </div>
        {hasDate ? (
          <div className="vol-3">
            <label>Date<input type="date" name="event_date" defaultValue={o?.eventDate ?? ""} {...bad("event_date")} /></label>
            <label>Starts <span className="hint">Optional</span><input type="time" name="start_time" defaultValue={o?.startTime ?? ""} {...bad("start_time")} /></label>
            <label>Ends <span className="hint">Optional</span><input type="time" name="end_time" defaultValue={o?.endTime ?? ""} {...bad("end_time")} /></label>
          </div>
        ) : (
          <label>When <span className="hint">As families should read it, for example: Fridays · 10:40 a.m.–12:30 p.m.</span>
            <input type="text" name="when_text" defaultValue={o?.whenText} maxLength={80} {...bad("event_date")} /></label>
        )}
      </fieldset>
      <div className="adm-row">
        <label>Place<input type="text" name="location" defaultValue={o?.location} maxLength={200} placeholder="For example: Marian Hall" /></label>
        <label>Spots <span className="hint">How many families can sign up. Empty = no limit.</span>
          <input type="number" name="spots" min={1} max={1000} inputMode="numeric" defaultValue={o?.spots ?? ""} {...bad("spots")} /></label>
      </div>
      <label>Who it is for <span className="hint">Optional, for example: Open to all parents</span><input type="text" name="who_text" defaultValue={o?.whoText} maxLength={80} /></label>
      <fieldset>
        <legend>Contact person</legend>
        <div className="vol-3">
          <label>Name<input type="text" name="contact_name" defaultValue={o?.contactName} maxLength={100} autoComplete="off" /></label>
          <label>Email<input type="email" name="contact_email" defaultValue={o?.contactEmail} maxLength={200} autoComplete="off" {...bad("contact_email")} /></label>
          <label>Phone<input type="tel" name="contact_phone" defaultValue={o?.contactPhone} maxLength={40} autoComplete="off" {...bad("contact_phone")} /></label>
        </div>
      </fieldset>
      <label className="adm-check"><input type="checkbox" name="portal_signup" defaultChecked={o ? o.portalSignup : true} />Families sign up on the portal (shows spots left and a “Sign up” button)</label>
      <details className="vol-more" open={!!o && (o.imported || !!o.details || o.links.length > 0)}>
        <summary>More: organizer, list of details, buttons and flyer</summary>
        <div className="adm-f">
          <label>Organizer <span className="hint">Optional, shown under the title</span><input type="text" name="organizer" defaultValue={o?.organizer} maxLength={200} /></label>
          <label>Title of the list<input type="text" name="details_title" defaultValue={o?.detailsTitle ?? "Details"} maxLength={80} /></label>
          <label>List of details <span className="hint">One item per line. Put **two stars** around words to show them in bold.</span>
            <textarea name="details" defaultValue={o?.details} rows={5} maxLength={5000} /></label>
          <fieldset>
            <legend>Buttons</legend>
            <span className="hint">For example a sign-up sheet, an email or a phone. When families sign up on the portal, these go under “Details and contacts”; otherwise the first one is the main button.</span>
            {Array.from({ length: Math.max(LINK_ROWS, links.length) }, (_, i) => (
              <div className="vol-link" key={i}>
                <label>Text<input type="text" name={`link_label_${i}`} defaultValue={links[i]?.label} maxLength={60} {...bad(`link_label_${i}`)} /></label>
                <label>Address<input type="text" name={`link_href_${i}`} defaultValue={links[i]?.href} maxLength={500} placeholder="https://…  or  mailto:name@example.com" {...bad(`link_href_${i}`)} /></label>
              </div>
            ))}
          </fieldset>
          <label>Flyer <span className="hint">Optional: a file of the portal (assets/flyers/…) or a full https:// address</span><input type="text" name="flyer" defaultValue={o?.flyer} maxLength={500} {...bad("flyer")} /></label>
        </div>
      </details>
      <label className="adm-check"><input type="checkbox" name="hidden" defaultChecked={o?.hidden ?? false} />Hidden (families do not see it)</label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : o ? "Save" : "Create opportunity"}</button>
        <button type="button" className="btn btn--outline" onClick={() => onDone()}>Cancel</button>
      </div>
    </form>
  );
}

export function VolunteerManager({ opps }: { opps: Opportunity[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [msg, setMsg] = useState<VolResult | null>(null);
  const [busy, start] = useTransition();
  const run = (p: Promise<VolResult>) => start(async () => { setConfirm(null); setMsg(await p); router.refresh(); });
  const done = (r?: VolResult) => { setEditing(null); setMsg(r ?? null); };
  const current = opps.find((o) => o.id === editing);
  return (
    <>
      <Head title="Volunteer" lead={<>The opportunities on the portal’s <a href="/volunteer" target="_blank" rel="noopener">Volunteer page</a>. Families who signed in can sign up; you see who did.</>} actions={<>{editing === null && <button type="button" className="btn btn--primary" onClick={() => { setMsg(null); setEditing("new"); }}>New opportunity</button>}</>} />
      <div className="adm-card">
      {msg && <p className={`adm-msg ${msg.error ? "adm-msg--err" : "adm-msg--ok"}`} role="status">{msg.error ?? msg.ok}</p>}
      {editing === "new" && <OppForm onDone={done} />}
      {current && <OppForm key={current.id} o={current} onDone={done} />}
      {editing === null && (opps.length ? (
        <ul className="adm-list">
          {opps.map((o) => (
            <li key={o.id} className={`adm-doc${o.hidden ? " is-hidden" : ""}`}>
              <div className="what">
                <strong>{o.title}</strong>
                <span className="note">{KINDS[o.kind]} · {whenLabel(o) || "No date"}{o.location && <> · {o.location}</>}</span>
                <span className="note">
                  {o.portalSignup
                    ? <>{spotsLabel(o)} · <SLink href={`/admin/volunteer/${o.id}`}>See who signed up ({o.taken})</SLink></>
                    : "Sign-up outside the portal (its own button)"}
                </span>
              </div>
              <div className="act">
                {confirm === o.id ? (
                  <span className="confirm">
                    <span>Delete “{o.title}”{o.taken ? ` and its ${o.taken} sign-up${o.taken === 1 ? "" : "s"}` : ""}? This cannot be undone.</span>
                    <button type="button" className="danger" autoFocus disabled={busy} onClick={() => run(deleteOpportunity(o.id))}>Delete</button>
                    <button type="button" onClick={() => setConfirm(null)}>Cancel</button>
                  </span>
                ) : (<>
                  <Badge on={!o.hidden} />
                  <button type="button" className="sp-edit" aria-label={`Edit ${o.title}`} onClick={() => { setMsg(null); setEditing(o.id); }}><PencilIcon />Edit</button>
                  <RowMenu label={o.title} items={[
                    { label: o.hidden ? "Show on the portal" : "Hide from the portal", disabled: busy, onSelect: () => run(setOpportunityHidden(o.id, !o.hidden)) },
                    { label: "Delete", danger: true, onSelect: () => { setMsg(null); setConfirm(o.id); } },
                  ]} />
                </>)}
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="adm-empty">No opportunities yet. Create the first one with “New opportunity”.</p>)}
      </div>
    </>
  );
}
