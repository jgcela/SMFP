"use client";
import { useRouter } from "next/navigation";
import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { LINK_GROUPS, PORTAL_PAGES, PORTAL_SECTIONS, checkHref, opensInNewTabByDefault, type LinkGroup } from "../../../lib/links";
import { deleteLink, moveLink, saveLink, setLinkHidden, type LinkState } from "./actions";
import { Badge, Head, PencilIcon, RowMenu } from "../ui";

export type AdminLink = {
  id: number; placement: LinkGroup; label: string; shortLabel: string; href: string; newTab: boolean; hidden: boolean;
};
type Category = { key: string; name: string };
type SitePage = { slug: string; title: string; legacy: string };
type Msg = { text: string; err?: boolean } | null;

// ----------------------------------------------------------------- form ----

function LinkForm({ link, group, categories, pages, onDone }: {
  link: AdminLink | null; group: LinkGroup; categories: Category[]; pages: SitePage[]; onDone: (msg: string) => void;
}) {
  const [state, action, pending] = useActionState<LinkState, FormData>(saveLink, undefined);
  const [href, setHref] = useState(link?.href ?? "");
  const [warning, setWarning] = useState<string | null>(null);
  const [newTab, setNewTab] = useState(link?.newTab ?? false);
  const [tabTouched, setTabTouched] = useState(!!link);
  const ref = useRef<HTMLFormElement>(null);
  const keys = categories.map((c) => c.key);
  const pagePaths = pages.flatMap((p) => [`pages/${p.slug}`, p.legacy].filter(Boolean));
  useEffect(() => { ref.current?.scrollIntoView({ block: "nearest" }); ref.current?.querySelector<HTMLInputElement>("input[name=label]")?.focus(); }, []);
  useEffect(() => { if (state?.ok) onDone(state.ok); }, [state, onDone]);

  const changeHref = (v: string) => {
    setHref(v);
    if (warning) setWarning(checkHref(v, keys, pagePaths)); // update an existing warning as they fix it
    if (!tabTouched) setNewTab(opensInNewTabByDefault(v));
  };
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const problem = checkHref(href, keys, pagePaths);
    setWarning(problem);
    if (problem) { ref.current?.querySelector<HTMLInputElement>("input[name=href]")?.focus(); return; }
    const fd = new FormData(e.currentTarget);
    startTransition(() => action(fd));
  };

  const groupName = LINK_GROUPS.find((g) => g.key === group)?.name ?? "";
  const shortHelp = group === "facts" ? "Shown instead of the full text on small phones." : group === "top" ? "Shown in the top bar. The phone menu shows the full text." : null;
  return (
    <form ref={ref} className="adm-f adm-panel" onSubmit={submit} noValidate>
      <h2>{link ? `Edit link · ${groupName}` : `New link · ${groupName}`}</h2>
      {state?.error && <p className="adm-msg adm-msg--err" role="alert">{state.error}</p>}
      {link ? <input type="hidden" name="id" value={link.id} /> : <input type="hidden" name="placement" value={group} />}
      <label>
        Text
        <input type="text" name="label" maxLength={60} required defaultValue={link?.label ?? ""} />
      </label>
      {shortHelp && (
        <label>
          Shorter text (optional)
          <span className="hint">{shortHelp}</span>
          <input type="text" name="short_label" maxLength={30} defaultValue={link?.shortLabel ?? ""} />
        </label>
      )}
      <label>
        Address
        <span className="hint">A full web address that starts with https://, or one of the portal’s own pages or sections from the suggestions.</span>
        <input type="text" name="href" inputMode="url" list="link-targets" maxLength={1000} required placeholder="https://"
          value={href} onChange={(e) => changeHref(e.target.value)} onBlur={() => href.trim() && setWarning(checkHref(href, keys, pagePaths))}
          aria-invalid={!!warning} aria-describedby={warning ? "href-warning" : undefined} />
        {warning && <span id="href-warning" className="adm-msg adm-msg--err" role="alert">{warning}</span>}
      </label>
      <datalist id="link-targets">
        {pages.map((p) => <option key={p.slug} value={`pages/${p.slug}`}>{`Page: ${p.title}`}</option>)}
        {PORTAL_PAGES.map((p) => <option key={p.href} value={p.href}>{`Page: ${p.name}`}</option>)}
        {PORTAL_SECTIONS.map((s) => <option key={s.href} value={s.href}>{`Section: ${s.name}`}</option>)}
        {categories.map((c) => <option key={c.key} value={`#cat-${c.key}`}>{`Documents: ${c.name}`}</option>)}
      </datalist>
      <label className="adm-check">
        <input type="checkbox" name="new_tab" checked={newTab} onChange={(e) => { setTabTouched(true); setNewTab(e.target.checked); }} />
        Open in a new tab
      </label>
      <div className="adm-actions">
        <button type="submit" className="btn btn--primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
        <button type="button" className="btn btn--outline" onClick={() => onDone("")}>Cancel</button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ rows ----

function Confirm({ label, onYes, onNo }: { label: string; onYes: () => Promise<void>; onNo: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <span className="confirm" role="group" aria-label={label}>
      <span>{label}</span>
      <button type="button" className="danger" autoFocus disabled={busy} onClick={async () => { setBusy(true); await onYes(); setBusy(false); }}>
        {busy ? "Deleting…" : "Yes, delete"}
      </button>
      <button type="button" onClick={onNo} disabled={busy}>Cancel</button>
    </span>
  );
}

const openHref = (href: string) => (/^https?:\/\//i.test(href) ? href : href.startsWith("#") ? `/${href}` : `/${href.replace(/^\//, "")}`);

function LinkRow({ l, first, last, onEdit, report }: { l: AdminLink; first: boolean; last: boolean; onEdit: () => void; report: (r: LinkState) => void }) {
  const [confirming, setConfirming] = useState(false);
  const fixed = l.placement === "facts";
  return (
    <li className={`adm-doc${l.hidden ? " is-hidden" : ""}`}>
      <div className="what">
        <strong>
          {l.label}
          {l.shortLabel && <span className="note"> · short: {l.shortLabel}</span>}
          
        </strong>
        <span className="note adm-href">
          {l.href}
          {l.newTab && <> · opens in a new tab</>}
        </span>
      </div>
      <div className="act">
        {confirming ? (
          <Confirm label="Delete this link?" onNo={() => setConfirming(false)}
            onYes={async () => { const r = await deleteLink(l.id); setConfirming(false); report(r); }} />
        ) : (
          <>
            <Badge on={!l.hidden} />
            <a href={openHref(l.href)} target="_blank" rel="noopener">Open<span className="sr-only"> {l.label} (opens in a new tab)</span></a>
            <button type="button" className="sp-edit" onClick={onEdit} aria-label={`Edit ${l.label}`}><PencilIcon />Edit</button>
            <RowMenu label={l.label} items={[
              ...(fixed ? [] : [
                { label: "Move to the first place", disabled: first, onSelect: async () => report(await moveLink(l.id, "first")) },
                { label: "Move up", disabled: first, onSelect: async () => report(await moveLink(l.id, -1)) },
                { label: "Move down", disabled: last, onSelect: async () => report(await moveLink(l.id, 1)) },
              ]),
              { label: l.hidden ? "Show on the portal" : "Hide from the portal", onSelect: async () => report(await setLinkHidden(l.id, !l.hidden)) },
              ...(fixed ? [] : [{ label: "Delete", danger: true, onSelect: () => setConfirming(true) }]),
            ]} />
          </>
        )}
      </div>
    </li>
  );
}

// --------------------------------------------------------------- manager ----

type Editing = { group: LinkGroup; link: AdminLink | null } | null;

export function LinksManager({ links, categories, pages }: { links: AdminLink[]; categories: Category[]; pages: SitePage[] }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const router = useRouter();
  const report = (r: LinkState) => {
    if (r?.error) setMsg({ text: r.error, err: true });
    else if (r?.ok) { setMsg({ text: r.ok }); router.refresh(); }
  };
  const done = (text: string) => { setEditing(null); if (text) { setMsg({ text }); router.refresh(); } };
  const open = (e: Editing) => { setMsg(null); setEditing(e); };

  return (
    <>
      <Head title="Links" lead={<>The shortcuts, the main menu and the FACTS button of the portal, in this order. Hidden links stay here but are not shown to families.</>} />
      <div className="adm-card">
      {msg && <p className={`adm-msg ${msg.err ? "adm-msg--err" : "adm-msg--ok"}`} role="status">{msg.text}</p>}
      {editing && (
        <LinkForm key={`${editing.group}-${editing.link?.id ?? "new"}`} link={editing.link} group={editing.group} categories={categories} pages={pages} onDone={done} />
      )}
      {LINK_GROUPS.map((g) => {
        const items = links.filter((l) => l.placement === g.key);
        return (
          <section key={g.key} className="adm-cat" aria-labelledby={`g-${g.key}`}>
            <div className="adm-cat-top">
              <div>
                <h2 id={`g-${g.key}`}>{g.name} <span className="count">{items.length}</span></h2>
                <p className="note">{g.lead}</p>
              </div>
              {g.key !== "facts" && (
                <div className="act">
                  <button type="button" onClick={() => open({ group: g.key, link: null })}>Add link</button>
                </div>
              )}
            </div>
            {items.length ? (
              <ul className="adm-list">
                {items.map((l, i) => (
                  <LinkRow key={l.id} l={l} first={i === 0} last={i === items.length - 1} report={report}
                    onEdit={() => open({ group: g.key, link: l })} />
                ))}
              </ul>
            ) : (
              <p className="adm-empty">No links yet.</p>
            )}
          </section>
        );
      })}
      </div>
    </>
  );
}
