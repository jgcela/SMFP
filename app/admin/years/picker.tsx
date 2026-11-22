"use client";
// The year the staff panel is working on, under the school's name in the menu.
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { pickYear } from "./actions";

export function YearPicker({ current, years }: { current: number; years: { id: number; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const id = useId();
  return (
    <form className="sp-year" action={(fd) => start(async () => { await pickYear(fd); router.refresh(); })}>
      <label htmlFor={id}>School year</label>
      <select id={id} name="year_id" defaultValue={current} key={current} disabled={pending}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        {years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}
      </select>
      <noscript><button type="submit">Open</button></noscript>
    </form>
  );
}
