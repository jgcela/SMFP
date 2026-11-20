"use server";
// Calendar actions. Every one checks the signed-in user's school on the
// server and only touches rows of that school.
import { revalidatePath } from "next/cache";
import { db } from "../../../lib/db";
import { requireYearStaff } from "../../../lib/staff";
import { ALL_CATEGORY_KEYS, CATEGORIES, parseCsv, parseIcs, validateEvent, type EventInput, type ImportRow } from "../../../lib/events";

export type EventState = { error?: string; ok?: string; savedId?: number } | undefined;

const requireStaff = requireYearStaff;

function refresh() {
  revalidatePath("/"); // the families' portal: list, month view and notice
  revalidatePath("/admin/calendar");
}

function readEvent(fd: FormData): EventInput {
  const allDay = fd.get("all_day") === "on";
  const time = String(fd.get("time") ?? "").trim();
  return {
    title: String(fd.get("title") ?? "").trim(),
    date: String(fd.get("date") ?? "").trim(),
    time: allDay ? null : time || "",
    endDate: null,
    category: String(fd.get("category") ?? ""),
    note: String(fd.get("note") ?? "").trim(),
  };
}

export async function saveEvent(_prev: EventState, fd: FormData): Promise<EventState> {
  try {
    const staff = await requireStaff();
    const id = Number(fd.get("id") ?? 0) || null;
    const e = readEvent(fd);
    if (e.time === "") return { error: "Choose a time, or mark the event as all day." };
    let allowed: string[] = CATEGORIES.map((c) => c.key);
    if (id) {
      // An older event may keep the category it already has (e.g. Health).
      const [cur] = await db()<{ category: string; event_date: string; end_date: string | null }[]>`
        select category, event_date::text, end_date::text from events where id = ${id} and school_id = ${staff.schoolId} and year_id = ${staff.yearId}`;
      if (!cur) return { error: "This event no longer exists. Reload the page." };
      if (ALL_CATEGORY_KEYS.includes(cur.category)) allowed = [...new Set([...allowed, cur.category])];
      // Keep a multi-day break's length when only other fields change.
      if (cur.end_date && cur.event_date === e.date) e.endDate = cur.end_date;
    }
    const err = validateEvent(e, allowed);
    if (err) return { error: err };

    if (id) {
      await db()`
        update events set title = ${e.title}, event_date = ${e.date}, end_date = ${e.endDate},
          start_time = ${e.time}, category = ${e.category}, details = ${e.note}
        where id = ${id} and school_id = ${staff.schoolId} and year_id = ${staff.yearId}`;
      refresh();
      return { ok: "Event saved.", savedId: id };
    }
    const [row] = await db()<{ id: number }[]>`
      insert into events (school_id, year_id, event_date, start_time, category, title, details, sort_order)
      values (${staff.schoolId}, ${staff.yearId}, ${e.date}, ${e.time}, ${e.category}, ${e.title}, ${e.note},
        (select coalesce(max(sort_order), 0) + 1 from events where school_id = ${staff.schoolId} and year_id = ${staff.yearId}))
      returning id`;
    refresh();
    return { ok: "Event added.", savedId: row.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not save. Try again." };
  }
}

export async function deleteEvent(id: number): Promise<EventState> {
  try {
    const staff = await requireStaff();
    const res = await db()`delete from events where id = ${Number(id)} and school_id = ${staff.schoolId} and year_id = ${staff.yearId}`;
    if (!res.count) return { error: "This event no longer exists." };
    refresh();
    return { ok: "Event deleted." };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not delete. Try again." };
  }
}

// ---- Import ----
export type PreviewState = { error?: string; rows?: ImportRow[]; fileName?: string } | undefined;

const MAX_BYTES = 1024 * 1024;

async function markDuplicates(yearId: number, rows: ImportRow[]) {
  const dates = [...new Set(rows.filter((r) => r.date).map((r) => r.date))];
  if (!dates.length) return;
  const existing = await db()<{ d: string; title: string }[]>`
    select event_date::text as d, lower(trim(title)) as title from events
    where year_id = ${yearId} and event_date = any(${dates}::date[])`;
  const key = new Set(existing.map((x) => `${x.d}|${x.title}`));
  const seen = new Set<string>();
  for (const r of rows) {
    const k = `${r.date}|${r.title.trim().toLowerCase()}`;
    if (key.has(k) || seen.has(k)) r.duplicate = true;
    seen.add(k);
  }
}

export async function previewImport(_prev: PreviewState, fd: FormData): Promise<PreviewState> {
  try {
    const staff = await requireStaff();
    const file = fd.get("file");
    const fallback = String(fd.get("default_category") ?? "community");
    if (!CATEGORIES.some((c) => c.key === fallback)) return { error: "Choose a default category." };
    if (!(file instanceof File) || !file.size) return { error: "Choose a .ics or .csv file." };
    if (file.size > MAX_BYTES) return { error: "The file is larger than 1 MB." };
    const name = file.name.toLowerCase();
    const text = await file.text();
    let parsed;
    if (name.endsWith(".ics") || name.endsWith(".ical") || text.trimStart().toUpperCase().startsWith("BEGIN:VCALENDAR")) {
      const [s] = await db()<{ timezone: string }[]>`select timezone from schools where id = ${staff.schoolId}`;
      parsed = parseIcs(text, fallback, s?.timezone ?? "UTC");
    } else if (name.endsWith(".csv") || name.endsWith(".txt")) parsed = parseCsv(text, fallback);
    else return { error: "Only .ics and .csv files can be imported." };
    if (parsed.error) return { error: parsed.error };
    await markDuplicates(staff.yearId, parsed.rows);
    parsed.rows.sort((a, b) => (a.date || "9").localeCompare(b.date || "9") || (a.time ?? "").localeCompare(b.time ?? ""));
    return { rows: parsed.rows, fileName: file.name };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not read the file." };
  }
}

export async function importEvents(rows: EventInput[]): Promise<{ error?: string; added?: number; skipped?: number }> {
  try {
    const staff = await requireStaff();
    if (!Array.isArray(rows) || !rows.length) return { error: "Choose at least one event to import." };
    if (rows.length > 500) return { error: "At most 500 events at a time." };
    const clean: EventInput[] = [];
    for (const r of rows) {
      const e: EventInput = {
        title: String(r?.title ?? "").trim(), date: String(r?.date ?? ""), time: r?.time ? String(r.time) : null,
        endDate: r?.endDate ? String(r.endDate) : null, category: String(r?.category ?? ""), note: String(r?.note ?? "").trim(),
      };
      const err = validateEvent(e);
      if (err) return { error: `“${e.title || "Untitled"}” (${e.date}): ${err}` };
      clean.push(e);
    }
    // Skip events already in the calendar (same date and title).
    const asRows = clean.map((e, i) => ({ ...e, line: i }) as ImportRow);
    await markDuplicates(staff.yearId, asRows);
    const toAdd = asRows.filter((r) => !r.duplicate);
    await db().begin(async (sql) => {
      const [{ base }] = await sql<{ base: number }[]>`
        select coalesce(max(sort_order), 0) as base from events where school_id = ${staff.schoolId} and year_id = ${staff.yearId}`;
      let n = 0;
      for (const e of toAdd) {
        n++;
        await sql`
          insert into events (school_id, year_id, event_date, end_date, start_time, category, title, details, sort_order)
          values (${staff.schoolId}, ${staff.yearId}, ${e.date}, ${e.endDate}, ${e.time}, ${e.category}, ${e.title}, ${e.note}, ${base + n})`;
      }
    });
    refresh();
    return { added: toAdd.length, skipped: asRows.length - toAdd.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not import. Try again." };
  }
}
