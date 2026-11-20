"use client";
// Staff: the cards of the portal's Staff favorites page. Create, edit, hide, reorder
// and delete (with a confirmation).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FAVORITE_LABELS, MAX_FAVORITES, PHOTO_ACCEPT, PHOTO_MAX_BYTES, VISIBLE_FAVORITES, type Favorite, type StaffCard, type Team } from "../../../lib/staff-favorites";
import { deleteStaffCard, moveStaffCard, saveStaffCard, setStaffHidden, startPhotoUpload, type SfResult } from "./actions";
import { Badge, Head, Initials, PencilIcon, RowMenu } from "../ui";

const photoUrl = (c: StaffCard) => `/staff-favorites/photo/${c.id}?v=${c.version}`;

function CardForm({ c, teams, storageReady, onDone }: { c?: StaffCard; teams: Team[]; storageReady: boolean; onDone: (r?: SfResult) => void }) {
  const router = useRouter();
  const [res, setRes] = useState<SfResult | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [rows, setRows] = useState<Favorite[]>(() => {
    const f = c?.favorites ?? [];
    return f.length ? [...f, { label: "", value: "" }] : FAVORITE_LABELS.slice(0, VISIBLE_FAVORITES).map((label) => ({ label, value: "" }));
  });
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("photo");
    fd.delete("photo");
    const focus = (f?: string) => { if (f) (form.elements.namedItem(f) as HTMLElement | null)?.focus(); };
    if (file instanceof File && file.size > 0) {
      if (file.size > PHOTO_MAX_BYTES) { setRes({ error: "The photo is larger than 5 MB.", field: "photo" }); focus("photo"); return; }
      setUploading(true);
      const t = await startPhotoUpload(file.name, file.size);
      if ("error" in t) { setUploading(false); setRes({ error: t.error, field: "photo" }); focus("photo"); return; }
      try {
        const r = await fetch(t.putUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
        if (!r.ok) throw new Error(String(r.status));
      } catch {
        setUploading(false);
        setRes({ error: "The photo could not be sent to storage. Check your connection and try again.", field: "photo" });
        return;
      }
      setUploading(false);
      fd.set("photo_token", t.token);
    }
    start(async () => {
      const r = await saveStaffCard(fd);
      if (r.ok) { onDone(r); router.refresh(); return; }
      setRes(r);
      focus(r.field);
    });
  };
  const bad = (f: string) => (res?.field === f ? { "aria-invalid": true } : {});
  const set = (i: number, k: keyof Favorite, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const move = (i: number, d: -1 | 1) => setRows((rs) => { const n = [...rs]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const busy = pending || uploading;
  return (
    <form className="adm-f adm-panel" onSubmit={onSubmit} noValidate>
      <h2>{c ? `Edit ${c.name}` : "New staff member"}</h2>
      {res?.error && <p className="adm-msg adm-msg--err" role="alert">{res.error}</p>}
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="adm-row">
        <label>Name<input type="text" name="name" defaultValue={c?.name} maxLength={100} autoFocus placeholder="For example: Mrs. Russell" {...bad("name")} /></label>
        <label>Role or grade<input type="text" name="role" defaultValue={c?.role} maxLength={150} placeholder="For example: 3rd Grade" /></label>
      </div>
      <label>Group on the page
        <select name="team" defaultValue={c?.team ?? teams[0]?.key ?? ""} {...bad("team")}>
          {teams.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          <option value="">Other staff</option>
        </select>
      </label>
      <fieldset>
        <legend>Photo (optional)</legend>
        {c?.photo && <p className="sf-photo-now"><img src={photoUrl(c)} alt={`Current photo of ${c.name}`} width={56} height={56} />
          <label className="adm-check"><input type="checkbox" name="remove_photo" />Remove this photo</label></p>}
        {storageReady
          ? <label>{c?.photo ? "Replace with another photo" : "Choose a photo"} <span className="hint">PNG, JPG, GIF or WebP, up to 5 MB. Only families who signed in see it.</span>
              <input type="file" name="photo" accept={PHOTO_ACCEPT} {...bad("photo")} /></label>
          : <p className="adm-msg adm-msg--err">Photo uploads are not set up yet.</p>}
      </fieldset>
      <fieldset>
        <legend>Favorites</legend>
        <span className="hint">The first {VISIBLE_FAVORITES} are always visible on the card; the rest go under “More favorites”. Empty rows are ignored. Do not add allergies, health details or birthdays: they are not published.</span>
        <datalist id="sf-labels">{FAVORITE_LABELS.map((l) => <option key={l} value={l} />)}</datalist>
        <ol className="sf-favs">
          {rows.map((r, i) => (
            <li key={i} className="sf-fav">
              <label>What<input type="text" name={`fav_label_${i}`} list="sf-labels" value={r.label} onChange={(e) => set(i, "label", e.target.value)} maxLength={60} placeholder="Morning drink" {...bad(`fav_label_${i}`)} /></label>
              <label>Favorite<input type="text" name={`fav_value_${i}`} value={r.value} onChange={(e) => set(i, "value", e.target.value)} maxLength={300} {...bad(`fav_value_${i}`)} /></label>
              <span className="sf-fav-act">
                <button type="button" aria-label={`Move “${r.label || "this favorite"}” up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" aria-label={`Move “${r.label || "this favorite"}” down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" aria-label={`Remove “${r.label || "this favorite"}”`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Remove</button>
              </span>
            </li>
          ))}
        </ol>
        {rows.length < MAX_FAVORITES && <button type="button" className="btn btn--outline" onClick={() => setRows((rs) => [...rs, { label: "", value: "" }])}>Add a favorite</button>}
      </fieldset>
      <label>Classroom wishlist link <span className="hint">Optional. Shows a “Classroom wishlist” button: an https:// address or a page of the portal.</span>
        <input type="text" name="wishlist_href" defaultValue={c?.wishlistHref} maxLength={500} {...bad("wishlist_href")} /></label>
      <label className="adm-check"><input type="checkbox" name="hidden" defaultChecked={c?.hidden ?? false} />Hidden (families do not see this card)</label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={busy}>{uploading ? "Uploading the photo…" : pending ? "Saving…" : c ? "Save" : "Add staff member"}</button>
        <button type="button" className="btn btn--outline" onClick={() => onDone()}>Cancel</button>
      </div>
    </form>
  );
}

export function StaffFavoritesManager({ cards, teams, storageReady }: { cards: StaffCard[]; teams: Team[]; storageReady: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [msg, setMsg] = useState<SfResult | null>(null);
  const [q, setQ] = useState("");
  const [busy, start] = useTransition();
  const run = (p: Promise<SfResult>) => start(async () => { setConfirm(null); setMsg(await p); router.refresh(); });
  const done = (r?: SfResult) => { setEditing(null); setMsg(r ?? null); };
  const current = cards.find((c) => c.id === editing);
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const words = norm(q).trim().split(/\s+/).filter(Boolean);
  const shown = cards.filter((c) => words.every((w) => norm(`${c.name} ${c.role}`).includes(w)));
  const groups = [...teams, { key: "", label: "Other staff" }].map((t) => ({ ...t, cards: shown.filter((c) => (teams.some((x) => x.key === c.team) ? c.team === t.key : t.key === "")) })).filter((g) => g.cards.length);
  return (
    <>
      <Head title="Staff favorites" lead={<>The cards on the portal’s <a href="/staff-favorites" target="_blank" rel="noopener">Staff favorites page</a>. Only families who signed in can see it.</>} actions={<>{editing === null && <button type="button" className="btn btn--primary" onClick={() => { setMsg(null); setEditing("new"); }}>New staff member</button>}</>} />
      <div className="adm-card">
      {msg && (msg.error || msg.ok) && <p className={`adm-msg ${msg.error ? "adm-msg--err" : "adm-msg--ok"}`} role="status">{msg.error ?? msg.ok}</p>}
      {editing === "new" && <CardForm teams={teams} storageReady={storageReady} onDone={done} />}
      {current && <CardForm key={current.id} c={current} teams={teams} storageReady={storageReady} onDone={done} />}
      {editing === null && (cards.length ? (<>
        <label className="adm-f sf-search">Find by name or role<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or role" /></label>
        {groups.length ? groups.map((g) => (
          <section key={g.key || "-"} aria-label={g.label}>
            <h2 className="adm-h2">{g.label} <span className="note">{g.cards.length}</span></h2>
            <ul className="sp-rows">
              {g.cards.map((c, i) => (
                <li key={c.id} className={`sp-row${c.hidden ? " is-hidden" : ""}`}>
                  <div className="sp-person">
                    {c.photo ? <img className="sp-ini" src={photoUrl(c)} alt="" width={48} height={48} /> : <Initials name={c.name} />}
                    <span>
                      <strong>{c.name}</strong>
                      <span className="note">{c.role}{c.role && " · "}{c.favorites.length ? `${c.favorites.length} favorite${c.favorites.length === 1 ? "" : "s"}` : "No favorites yet"}</span>
                    </span>
                  </div>
                  <div className="sp-act">
                    {confirm === c.id ? (
                      <span className="sp-confirm">
                        <span>Delete the card of {c.name}? This cannot be undone.</span>
                        <button type="button" className="danger" autoFocus disabled={busy} onClick={() => run(deleteStaffCard(c.id))}>Delete</button>
                        <button type="button" onClick={() => setConfirm(null)}>Cancel</button>
                      </span>
                    ) : (<>
                      <Badge on={!c.hidden} />
                      <button type="button" className="sp-edit" aria-label={`Edit ${c.name}`} onClick={() => { setMsg(null); setEditing(c.id); }}><PencilIcon />Edit</button>
                      <RowMenu label={c.name} items={[
                        ...(q ? [] : [
                          { label: "Move up", disabled: busy || i === 0, onSelect: () => run(moveStaffCard(c.id, -1)) },
                          { label: "Move down", disabled: busy || i === g.cards.length - 1, onSelect: () => run(moveStaffCard(c.id, 1)) },
                        ]),
                        { label: c.hidden ? "Show on the portal" : "Hide from the portal", disabled: busy, onSelect: () => run(setStaffHidden(c.id, !c.hidden)) },
                        { label: "Delete", danger: true, onSelect: () => { setMsg(null); setConfirm(c.id); } },
                      ]} />
                    </>)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )) : <p className="adm-empty">Nobody matches “{q}”.</p>}
      </>) : <p className="adm-empty">No staff cards yet. Add the first one with “New staff member”.</p>)}
      </div>
    </>
  );
}
