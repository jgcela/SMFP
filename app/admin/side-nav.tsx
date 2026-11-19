"use client";
// On a phone the sidebar's sections fold into a "Menu" button. On a computer
// they are always shown (CSS), so this only matters below 960 px.
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function SideNav({ menuIcon, closeIcon, children }: { menuIcon: React.ReactNode; closeIcon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btn.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button ref={btn} type="button" className="sp-menu-btn" aria-expanded={open} aria-controls="sp-nav" onClick={() => setOpen(!open)}>
        {open ? closeIcon : menuIcon}
        <span>{open ? "Close" : "Menu"}</span>
      </button>
      <div id="sp-nav" className="sp-navwrap" data-open={open ? "true" : undefined} onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
        {children}
      </div>
    </>
  );
}
