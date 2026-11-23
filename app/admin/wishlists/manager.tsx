"use client";
// Staff: the teachers' wishlists. Create, edit, hide, reorder and delete (with a confirmation).
// The items themselves live in each teacher's store list (Amazon).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Group, Wishlist } from "../../../lib/wishlists";
import { deleteWishlist, moveWishlist, saveWishlist, setWishlistHidden, type WlResult } from "./actions";
import { Badge, Head, Initials, PencilIcon, RowMenu, SearchField } from "../ui";

type Teacher = { id: number; name: string; role: string };

function ListForm({ w, groups, teachers, onDone }: { w?: Wishlist; groups: Group[]; teachers: Teacher[]; onDone: (r?: WlResult) => void }) {
  const router = useRouter();
  const [res, setRes] = useState<WlResult | null>(null);
  const [pending, start] = useTransition();
  const [staffId, setStaffId] = useState(w ? (w.staffId ? String(w.staffId) : "") : "");
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
      <label>Link to the teacher’s list in a store <span className="hint">For example their Amazon wishlist. The teacher keeps the items there. It starts with https://</span>
        <input type="url" name="store_url" defaultValue={w?.storeUrl} maxLength={500} {...bad("store_url")} /></label>
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
    <>
      <Head title="Wishlists" lead={<>The teachers’ lists on the portal’s <a href="/wishlists" target="_blank" rel="noopener">Teacher wishlists page</a>. Only families who signed in can see it.</>} actions={<><a className="btn btn--outline" href="/wishlists" target="_blank" rel="noopener">View family page<span className="sr-only"> (opens in a new tab)</span></a>{editing === null && <button type="button" className="btn btn--primary" onClick={() => { setMsg(null); setEditing("new"); }}>New wishlist</button>}</>} />
      <div className="adm-card">
      {msg && (msg.error || msg.ok) && <p className={`adm-msg ${msg.error ? "adm-msg--err" : "adm-msg--ok"}`} role="status">{msg.error ?? msg.ok}</p>}
      {editing === "new" && <ListForm groups={groups} teachers={teachers} onDone={done} />}
      {current && <ListForm key={current.id} w={current} groups={groups} teachers={teachers} onDone={done} />}
      {editing === null && (lists.length ? (<>
        <div className="sp-tools"><SearchField label="Find by teacher or grade" value={q} onChange={setQ} placeholder="Find by teacher or grade, for example: 2nd grade" /></div>
        {sections.length ? sections.map((g) => (
          <section key={g.key || "-"} aria-label={g.label}>
            <h2 className="adm-h2">{g.label} <span className="note">{g.lists.length}</span></h2>
            <ul className="sp-rows">
              {g.lists.map((l, i) => (
                <li key={l.id} className={`sp-row${l.hidden ? " is-hidden" : ""}`}>
                  <div className="sp-person">
                    <Initials name={l.name} />
                    <span>
                      <strong>{l.name}</strong>
                      <span className="note">{l.classText}{l.classText && " · "}{l.storeUrl ? <a href={l.storeUrl} target="_blank" rel="noopener">store list<span className="sr-only"> (opens in a new tab)</span></a> : "no store link yet"}{!l.staffId && " · not in Staff favorites"}</span>
                    </span>
                  </div>
                  <div className="sp-act">
                    {confirm === l.id ? (
                      <span className="sp-confirm">
                        <span>Delete {l.name}’s list? This cannot be undone.</span>
                        <button type="button" className="danger" autoFocus disabled={busy} onClick={() => run(deleteWishlist(l.id))}>Delete</button>
                        <button type="button" onClick={() => setConfirm(null)}>Cancel</button>
                      </span>
                    ) : (<>
                      <Badge on={!l.hidden} />
                      <button type="button" className="sp-edit" aria-label={`Edit ${l.name}’s list`} onClick={() => { setMsg(null); setEditing(l.id); }}><PencilIcon />Edit</button>
                      <RowMenu label={`${l.name}’s list`} items={[
                        ...(q ? [] : [
                          { label: "Move up", disabled: busy || i === 0, onSelect: () => run(moveWishlist(l.id, -1)) },
                          { label: "Move down", disabled: busy || i === g.lists.length - 1, onSelect: () => run(moveWishlist(l.id, 1)) },
                        ]),
                        { label: l.hidden ? "Show on the portal" : "Hide from the portal", disabled: busy, onSelect: () => run(setWishlistHidden(l.id, !l.hidden)) },
                        { label: "Delete", danger: true, onSelect: () => { setMsg(null); setConfirm(l.id); } },
                      ]} />
                    </>)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )) : <p className="adm-empty">Nobody matches “{q}”.</p>}
      </>) : <p className="adm-empty">No wishlists yet. Create the first one with “New wishlist”.</p>)}
      </div>
    </>
  );
}
