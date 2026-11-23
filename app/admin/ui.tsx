"use client";
// Pieces shared by every staff screen: the page heading, the "…" menu of a row,
// status badges and initials. The school's name and category colours come from
// the layout (database), never from the code.
import NextLink from "next/link";
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import type { Pill } from "../../lib/panel-theme";

// base: the start of every address of the school ("/s/stmary", step 10).
type SchoolInfo = { name: string; categories: Record<string, Pill>; base: string };
const School = createContext<SchoolInfo>({ name: "", categories: {}, base: "" });
export function SchoolProvider({ value, children }: { value: SchoolInfo; children: React.ReactNode }) {
  return <School.Provider value={value}>{children}</School.Provider>;
}
export const useSchool = () => useContext(School);

/** A link to a page of this school: <SLink href="/admin/calendar"> goes to /s/<code>/admin/calendar. */
export function SLink({ href, ...rest }: React.ComponentProps<typeof NextLink> & { href: string }) {
  const { base } = useSchool();
  return <NextLink href={href.startsWith("/") && !href.startsWith("//") ? `${base}${href}` : href} {...rest} />;
}

export function Head({ title, lead, actions, back }: { title: React.ReactNode; lead?: React.ReactNode; actions?: React.ReactNode; back?: React.ReactNode }) {
  const { name } = useSchool();
  return (
    <div className="sp-head">
      <div className="sp-head-t">
        {back && <p className="sp-back">{back}</p>}
        {name && <p className="sp-eyebrow">{name}</p>}
        <h1>{title}</h1>
        {lead && <p className="sp-lead">{lead}</p>}
      </div>
      {actions && <div className="sp-head-a">{actions}</div>}
    </div>
  );
}

// Category pill, coloured from the school's settings.
export function Cat({ k, label }: { k: string; label: string }) {
  const c = useSchool().categories[k];
  return <span className="sp-cat" style={c ? { background: c.bg, color: c.fg } : undefined}>{label}</span>;
}

export function Badge({ on, onText = "Visible", offText = "Hidden" }: { on: boolean; onText?: string; offText?: string }) {
  return <span className={`sp-badge${on ? " is-on" : ""}`}>{on ? onText : offText}</span>;
}

export function Initials({ name }: { name: string }) {
  const words = name.replace(/^(mrs?|ms|miss|dr|fr|sr|deacon)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  const ini = words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? "?").slice(0, 2);
  return <span className="sp-ini" aria-hidden="true">{ini.toUpperCase()}</span>;
}

export type MenuItem = { label: string; onSelect: () => void; disabled?: boolean; danger?: boolean };

// The "…" button of a row: secondary actions (move, hide, delete…). Works with the keyboard:
// arrows move between items, Escape closes and returns to the button.
export function RowMenu({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const all = () => [...(box.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)") ?? [])];
    all()[0]?.focus();
    const onDown = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node) && e.target !== btn.current) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setOpen(false); btn.current?.focus(); return; }
      if (e.key === "Tab") { setOpen(false); return; }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Home" && e.key !== "End") return;
      e.preventDefault();
      const list = all();
      const i = list.indexOf(document.activeElement as HTMLButtonElement);
      const n = e.key === "Home" ? 0 : e.key === "End" ? list.length - 1 : (i + (e.key === "ArrowDown" ? 1 : -1) + list.length) % list.length;
      list[n]?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div className="sp-menu">
      <button ref={btn} type="button" className="sp-more" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined}
        aria-label={`More actions for ${label}`} onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
      </button>
      {open && (
        <div ref={box} id={id} role="menu" aria-label={`Actions for ${label}`} className="sp-menu-list">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" disabled={it.disabled} className={it.danger ? "is-danger" : undefined}
              onClick={() => { setOpen(false); btn.current?.focus(); it.onSelect(); }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function PencilIcon() {
  return <svg className="sp-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" /></svg>;
}

// The one search box of the staff panels: a white pill with a magnifier, the
// label read by screen readers only (the placeholder says what to type).
export function SearchField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="sp-search">
      <span className="sr-only">{label}</span>
      <svg className="sp-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input type="search" placeholder={placeholder ?? label} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
