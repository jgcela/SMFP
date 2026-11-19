"use client";
// Staff: the teachers' wishlists. Create, edit (with items), hide, reorder, delete (with a
// confirmation), and mark items as got.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { MAX_ITEMS, type Group, type Wishlist } from "../../../lib/wishlists";
import { deleteWishlist, moveWishlist, saveWishlist, setItemDone, setWishlistHidden, type WlResult } from "./actions";

type Teacher = { id: number; name: string; role: string };
type Row = { key: number; id: number | null; name: string; url: string; quantity: string; done: boolean };
let nextKey = 1;
const blank = (): Row => ({ key: nextKey++, id: null, name: "", url: "", quantity: "1", done: false });

function ListForm({ w, groups, teachers, onDone }: { w?: Wishlist; groups: Group[]; teachers: Teacher[]; onDone: (r?: WlResult) => void }) {
  const router = useRouter();
  const [res, setRes] = useState<WlResult | null>(null);
  const [pending, start] = useTransition();
  const [staffId, setStaffId] = useState(w ? (w.staffId ? String(w.staffId) : "") : "");
  const [rows, setRows] = useState<Row[]>(() => [
    ...(w?.items ?? []).map((i) => ({ key: nextKey++, id: i.id, name: i.name, url: i.url, quantity: String(i.quantity), done: i.done })),
    blank(),
  ]);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    start(async () => {
      const r = await saveWishlist(fd);
      if (r.ok) { onDone(r); router.refresh(); return; }
      setRes(r);
      if (r.field) (form.elements.namedItem(r.field) as HTMLElement | null)?.focus();
    });
  };
  const bad = (f: string) => (res?.field === f ? { "aria-invalid": true } : {});
  const set = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) => setRows((rs) => { const n = [...rs]; [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const sorted = [...teachers].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <form className="adm-f adm-panel" onSubmit={onSubmit} noValidate>
      <h2>{w ? `Edit ${w.name}’s list` : "New wishlist"}</h2>
      {res?.error && <p className="adm-msg adm-msg--err" role="alert">{res.error}</p>}
      {w && <input type="hidden" name="id" value={w.id} />}
      <label>Teacher <span className="hint">From Staff favorites, so the name is written once. Change the name there.</span>
        <select name="staff_id" value={staffId} onChange={(e) => setStaffId(e.target.value)} autoFocus {...bad("staff_id")}>
          <option value="">Not in Staff favorites (write the name)</option>
          {sorted.map((t) => <option key={t.id} value={t.id}>{t.name}{t.role ? ` — ${t.role}` : ""}</option>)}
        </select>
      </label>
      {!staffId && <label>Name<input type="text" name="name" defaultValue={w?.staffId ? "" : w?.ownName} maxLength={100} placeholder="For example: Mrs. Ott" {...bad("name")} /></label>}
      <div className="adm-row">
        <label>Grade or class<input type="text" name="class_text" defaultValue={w?.classText} maxLength={150} placeholder="For example: 2nd Grade — 2A" /></label>
        <label>Group on the page
          <select name="grp" defaultValue={w?.grp ?? groups[0]?.key ?? ""} {...bad("grp")}>
            {groups.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
            <option value="">Other</option>
          </select>
        </label>
      </div>
      <label>Link to the teacher’s list in a store <span className="hint">Optional, for example their Amazon wishlist. It starts with https://</span>
        <input type="url" name="store_url" defaultValue={w?.storeUrl} maxLength={500} {...bad("store_url")} /></label>
      <fieldset>
        <legend>Items</legend>
        <span className="hint">Empty rows are ignored. Tick “Got it” when the item is no longer needed: families see it crossed out.</span>
        <ol className="sf-favs">
          {rows.map((r, i) => (
            <li key={r.key} className="wl-row">
              {r.id && <input type="hidden" name={`item_id_${i}`} value={r.id} />}
              <label>Item<input type="text" name={`item_name_${i}`} value={r.name} onChange={(e) => set(i, { name: e.target.value })} maxLength={200} placeholder="For example: Dry-erase markers" {...bad(`item_name_${i}`)} /></label>
              <label>Link <span className="hint">Optional</span><input type="url" name={`item_url_${i}`} value={r.url} onChange={(e) => set(i, { url: e.target.value })} maxLength={500} placeholder="https://…" {...bad(`item_url_${i}`)} /></label>
              <label>How many<input type="number" name={`item_qty_${i}`} value={r.quantity} min={1} max={999} inputMode="numeric" onChange={(e) => set(i, { quantity: e.target.value })} {...bad(`item_qty_${i}`)} /></label>
              <label className="adm-check wl-got-box"><input type="checkbox" name={`item_done_${i}`} checked={r.done} onChange={(e) => set(i, { done: e.target.checked })} />Got it</label>
              <span className="sf-fav-act">
                <button type="button" aria-label={`Move “${r.name || "this item"}” up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" aria-label={`Move “${r.name || "this item"}” down`} disabled={i === rows.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" aria-label={`Remove “${r.name || "this item"}”`} onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Remove</button>
              </span>
            </li>
          ))}
        </ol>
        {rows.length < MAX_ITEMS && <button type="button" className="btn btn--outline" onClick={() => setRows((rs) => [...rs, blank()])}>Add an item</button>}
      </fieldset>
      <label className="adm-check"><input type="checkbox" name="hidden" defaultChecked={w?.hidden ?? false} />Hidden (families do not see this list)</label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : w ? "Save" : "Create list"}</button>
        <button type="button" className="btn btn--outline" onClick={() => onDone()}>Cancel</button>
      </div>
    </form>
  );
}

export function WishlistsManager({ lists, groups, teachers }: { lists: Wishlist[]; groups: Group[]; teachers: Teacher[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [msg, setMsg] = useState<WlResult | null>(null);
  const [q, setQ] = useState("");
  const [busy, start] = useTransition();
  const run = (p: Promise<WlResult>) => start(async () => { setConfirm(null); setMsg(await p); router.refresh(); });
  const done = (r?: WlResult) => { setEditing(null); setMsg(r ?? null); };
  const current = lists.find((l) => l.id === editing);
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const words = norm(q).trim().split(/\s+/).filter(Boolean);
  const shown = lists.filter((l) => words.every((w) => norm(`${l.name} ${l.classText}`).includes(w)));
  const known = (l: Wishlist) => groups.some((g) => g.key === l.grp);
  const sections = [...groups, { key: "", label: "Other" }].map((g) => ({ ...g, lists: shown.filter((l) => (known(l) ? l.grp === g.key : g.key === "")) })).filter((g) => g.lists.length);
  return (
    <div className="adm-card">
      <div className="adm-head">
        <div>
          <h1>Wishlists</h1>
          <p className="lead">The teachers’ lists on the portal’s <a href="/wishlists" target="_blank" rel="noopener">Teacher wishlists page</a>. Only families who signed in can see it.</p>
        </div>
        {editing === null && <button type="button" className="btn btn--primary" onClick={() => { setMsg(null); setEditing("new"); }}>New wishlist</button>}
      </div>
      {msg && (msg.error || msg.ok) && <p className={`adm-msg ${msg.error ? "adm-msg--err" : "adm-msg--ok"}`} role="status">{msg.error ?? msg.ok}</p>}
      {editing === "new" && <ListForm groups={groups} teachers={teachers} onDone={done} />}
      {current && <ListForm key={current.id} w={current} groups={groups} teachers={teachers} onDone={done} />}
      {editing === null && (lists.length ? (<>
        <label className="adm-f sf-search">Find by teacher or grade<input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example: 2nd grade" /></label>
        {sections.length ? sections.map((g) => (
          <section key={g.key || "-"} aria-label={g.label}>
            <h2 className="adm-h2">{g.label} <span className="note">{g.lists.length}</span></h2>
            <ul className="adm-list">
              {g.lists.map((l, i) => {
                const got = l.items.filter((it) => it.done).length;
                return (
                  <li key={l.id} className={`adm-doc${l.hidden ? " is-hidden" : ""}`}>
                    <div className="what">
                      <strong>{l.name}{l.hidden && <span className="pill pill--muted">Hidden</span>}</strong>
                      <span className="note">{l.classText}{l.classText && " · "}{l.items.length ? `${l.items.length} item${l.items.length === 1 ? "" : "s"}${got ? `, ${got} got` : ""}` : "No items"}{l.storeUrl && " · store link"}{!l.staffId && " · not in Staff favorites"}</span>
                      {l.items.length > 0 && (
                        <ul className="wl-admin-items">
                          {l.items.map((it) => (
                            <li key={it.id} className={it.done ? "is-done" : ""}>
                              <span>{it.done ? <s>{it.name}</s> : it.name}{it.quantity > 1 && ` × ${it.quantity}`}</span>
                              <button type="button" disabled={busy} onClick={() => run(setItemDone(it.id, !it.done))}>{it.done ? "Needed again" : "Mark as got"}</button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="act">
                      {confirm === l.id ? (
                        <span className="confirm">
                          <span>Delete {l.name}’s list{l.items.length ? ` and its ${l.items.length} item${l.items.length === 1 ? "" : "s"}` : ""}? This cannot be undone.</span>
                          <button type="button" className="danger" autoFocus disabled={busy} onClick={() => run(deleteWishlist(l.id))}>Delete</button>
                          <button type="button" onClick={() => setConfirm(null)}>Cancel</button>
                        </span>
                      ) : (<>
                        {!q && <>
                          <button type="button" aria-label={`Move ${l.name} up`} disabled={busy || i === 0} onClick={() => run(moveWishlist(l.id, -1))}>↑</button>
                          <button type="button" aria-label={`Move ${l.name} down`} disabled={busy || i === g.lists.length - 1} onClick={() => run(moveWishlist(l.id, 1))}>↓</button>
                        </>}
                        <button type="button" onClick={() => { setMsg(null); setEditing(l.id); }}>Edit</button>
                        <button type="button" disabled={busy} onClick={() => run(setWishlistHidden(l.id, !l.hidden))}>{l.hidden ? "Show" : "Hide"}</button>
                        <button type="button" onClick={() => { setMsg(null); setConfirm(l.id); }}>Delete</button>
                      </>)}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )) : <p className="adm-empty">Nobody matches “{q}”.</p>}
      </>) : <p className="adm-empty">No wishlists yet. Create the first one with “New wishlist”.</p>)}
    </div>
  );
}
