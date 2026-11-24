// Calendar events: shared rules for the staff area (validation, categories,
// and reading .ics / .csv files for import).

export const CATEGORIES = [
  { key: "noclasses", label: "No school" },
  { key: "faith", label: "Faith" },
  { key: "academic", label: "Academic" },
  { key: "community", label: "Community" },
] as const;
// Older events may also use "health"; it is kept when such an event is edited.
export const ALL_CATEGORY_KEYS = ["noclasses", "faith", "academic", "community", "health"];
export const CATEGORY_LABEL: Record<string, string> = {
  noclasses: "No school", faith: "Faith", academic: "Academic", community: "Community", health: "Health",
};

export type EventInput = { title: string; date: string; time: string | null; endDate: string | null; category: string; note: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isRealDate(d: string) {
  if (!DATE_RE.test(d)) return false;
  const dt = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === d;
}

/** Returns an error message, or null when the event is valid. */
export function validateEvent(e: EventInput, allowed = CATEGORIES.map((c) => c.key) as string[]): string | null {
  if (!e.title) return "Write a title.";
  if (e.title.length > 150) return "The title can be at most 150 characters.";
  if (!isRealDate(e.date)) return "Choose a valid date.";
  if (e.date < "2000-01-01" || e.date > "2100-12-31") return "Choose a valid date.";
  if (e.time !== null && !TIME_RE.test(e.time)) return "Choose a valid time, or mark the event as all day.";
  if (e.endDate !== null && (!isRealDate(e.endDate) || e.endDate < e.date)) return "The end date must be on or after the date.";
  if (!allowed.includes(e.category)) return "Choose a category.";
  if (e.note.length > 500) return "The note can be at most 500 characters.";
  return null;
}

// ---------------------------------------------------------------- import ----

export type ImportRow = EventInput & { line: number; error?: string; duplicate?: boolean; repeats?: boolean };

const MAX_ROWS = 500;

/** Guess a category from the text when the file does not say. */
export function guessCategory(text: string, fallback: string) {
  const t = text.toLowerCase();
  if (/\bno (school|classes)\b|\bbreak\b|\bholiday\b|school closed|no class/.test(t)) return "noclasses";
  if (/\bmass\b|rosary|confession|adoration|prayer|sacrament|first communion|confirmation|liturg/.test(t)) return "faith";
  return fallback;
}

function categoryFromText(v: string): string | null {
  const t = v.trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (!t) return null;
  if (["noschool", "noclasses", "noclass", "holiday", "break"].includes(t)) return "noclasses";
  if (["faith", "academic", "community"].includes(t)) return t;
  return null;
}

/** "2026-11-19", "11/19/2026", "11/19/26" -> "2026-11-19" */
function parseDate(v: string): string | null {
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return fmtDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (m) return fmtDate(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
  return null;
}
function fmtDate(y: number, mo: number, d: number) {
  const s = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return isRealDate(s) ? s : null;
}

/** "6:30 PM", "6:30pm", "6 pm", "18:30" -> "18:30"; "" / "all day" -> null; bad -> undefined */
function parseTime(v: string): string | null | undefined {
  const s = v.trim().toLowerCase().replace(/\./g, "");
  if (!s || s === "all day" || s === "allday") return null;
  let m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m) {
    let h = +m[1] % 12;
    if (m[3] === "pm") h += 12;
    const min = m[2] ? +m[2] : 0;
    if (+m[1] > 12 || min > 59) return undefined;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m && +m[1] < 24 && +m[2] < 60) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return undefined;
}

function finish(rows: ImportRow[]): ImportRow[] {
  for (const r of rows) if (!r.error) r.error = validateEvent(r) ?? undefined;
  return rows;
}

// ---- CSV ----
function csvRecords(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === ";" || c === "\t") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); out.push(row); row = []; field = "";
    } else field += c;
  }
  if (field || row.length) { row.push(field); out.push(row); }
  return out.filter((r) => r.some((f) => f.trim()));
}

const COLS: Record<string, string[]> = {
  title: ["title", "subject", "summary", "event", "name", "event title"],
  date: ["date", "start date", "start", "event date", "day"],
  time: ["time", "start time"],
  endDate: ["end date", "end"],
  category: ["category", "type", "categories"],
  note: ["note", "notes", "description", "details", "location"],
  allDay: ["all day", "all day event", "allday"],
};

export function parseCsv(text: string, fallback: string): { rows: ImportRow[]; error?: string } {
  const recs = csvRecords(text.replace(/^﻿/, ""));
  if (recs.length < 2) return { rows: [], error: "The file has no events. The first row must be the column names (Title, Date, Time, Category, Note)." };
  const head = recs[0].map((h) => h.trim().toLowerCase());
  const idx: Record<string, number> = {};
  for (const [k, names] of Object.entries(COLS)) {
    const i = head.findIndex((h) => names.includes(h));
    if (i >= 0) idx[k] = i;
  }
  if (idx.title === undefined || idx.date === undefined) {
    return { rows: [], error: "The first row must name the columns. Title and Date are required (also: Time, Category, Note)." };
  }
  if (recs.length - 1 > MAX_ROWS) return { rows: [], error: `The file has more than ${MAX_ROWS} events. Split it into smaller files.` };
  const get = (r: string[], k: string) => (idx[k] === undefined ? "" : (r[idx[k]] ?? "").trim());
  const rows: ImportRow[] = recs.slice(1).map((r, n) => {
    const title = get(r, "title");
    const note = get(r, "note");
    const date = parseDate(get(r, "date"));
    const allDay = /^(true|yes|y|1|x)$/i.test(get(r, "allDay"));
    const t = allDay ? null : parseTime(get(r, "time"));
    const endRaw = get(r, "endDate");
    const end = endRaw ? parseDate(endRaw) : null;
    const cat = categoryFromText(get(r, "category")) ?? guessCategory(`${title} ${note}`, fallback);
    const row: ImportRow = { line: n + 2, title, date: date ?? "", time: t ?? null, endDate: end && end !== date ? end : null, category: cat, note };
    if (!date) row.error = `Date not understood: "${get(r, "date")}". Use 2026-11-19 or 11/19/2026.`;
    else if (t === undefined) row.error = `Time not understood: "${get(r, "time")}". Use 6:30 PM or leave it empty for all day.`;
    else if (endRaw && !end) row.error = `End date not understood: "${endRaw}".`;
    return row;
  });
  return { rows: finish(rows) };
}

// ---- iCalendar (.ics) ----
function unfold(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}
function icsText(v: string) {
  return v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").replace(/\s+/g, " ").trim();
}
function addDays(d: string, n: number) {
  const dt = new Date(`${d}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
/** Wall-clock date and time of an instant in a time zone. */
function inZone(utc: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(utc).map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
/** Local wall time in zone `from` -> wall time in zone `to`. */
function convertZone(date: string, time: string, from: string, to: string) {
  // Find the UTC instant whose wall time in `from` is date+time (two passes are enough).
  let guess = new Date(`${date}T${time}:00Z`);
  for (let i = 0; i < 2; i++) {
    const w = inZone(guess, from);
    const diff = new Date(`${w.date}T${w.time}:00Z`).getTime() - new Date(`${date}T${time}:00Z`).getTime();
    guess = new Date(guess.getTime() - diff);
  }
  return inZone(guess, to);
}
function validZone(tz: string) {
  try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}

export function parseIcs(text: string, fallback: string, schoolTz: string): { rows: ImportRow[]; error?: string } {
  const lines = unfold(text);
  if (!lines.some((l) => l.toUpperCase().startsWith("BEGIN:VCALENDAR"))) return { rows: [], error: "This is not a calendar (.ics) file." };
  const calTz = lines.find((l) => l.toUpperCase().startsWith("X-WR-TIMEZONE:"))?.split(":")[1]?.trim();
  const rows: ImportRow[] = [];
  let cur: Record<string, { params: string; value: string }> | null = null;
  let start = 0;
  lines.forEach((raw, n) => {
    const line = raw.trimEnd();
    const up = line.toUpperCase();
    if (up === "BEGIN:VEVENT") { cur = {}; start = n + 1; return; }
    if (up === "END:VEVENT" && cur) {
      rows.push(icsEvent(cur, start, fallback, schoolTz, calTz));
      cur = null;
      return;
    }
    if (!cur) return;
    const m = line.match(/^([A-Za-z-]+)((?:;[^:]*)?):(.*)$/);
    if (m && !(m[1].toUpperCase() in cur)) cur[m[1].toUpperCase()] = { params: m[2], value: m[3] };
  });
  if (!rows.length) return { rows: [], error: "The file has no events." };
  if (rows.length > MAX_ROWS) return { rows: [], error: `The file has more than ${MAX_ROWS} events. Split it into smaller files.` };
  return { rows: finish(rows) };
}

function icsEvent(p: Record<string, { params: string; value: string }>, line: number, fallback: string, schoolTz: string, calTz?: string): ImportRow {
  const title = icsText(p.SUMMARY?.value ?? "");
  const note = icsText(p.DESCRIPTION?.value ?? p.LOCATION?.value ?? "").slice(0, 500);
  const row: ImportRow = { line, title, date: "", time: null, endDate: null, category: fallback, note };
  const cats = (p.CATEGORIES?.value ?? "").split(",").map((c) => categoryFromText(icsText(c))).find(Boolean);
  row.category = cats ?? guessCategory(`${title} ${note}`, fallback);
  if (p.RRULE) row.repeats = true;
  if (p.STATUS?.value.toUpperCase() === "CANCELLED") row.error = "Cancelled in the calendar.";

  const ds = p.DTSTART;
  if (!ds) { row.error = "No start date."; return row; }
  const v = ds.value.trim();
  const dateOnly = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  const dateTime = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (dateOnly) {
    row.date = `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`;
    const de = p.DTEND?.value.trim().match(/^(\d{4})(\d{2})(\d{2})$/);
    if (de) {
      const last = addDays(`${de[1]}-${de[2]}-${de[3]}`, -1); // DTEND is the day after
      if (last > row.date) row.endDate = last;
    }
  } else if (dateTime) {
    const d = `${dateTime[1]}-${dateTime[2]}-${dateTime[3]}`, t = `${dateTime[4]}:${dateTime[5]}`;
    const tzParam = ds.params.match(/TZID=("?)([^;"]+)\1/i)?.[2];
    let w = { date: d, time: t };
    const tz = validZone(schoolTz) ? schoolTz : "UTC";
    if (dateTime[7]) w = inZone(new Date(`${d}T${t}:00Z`), tz);
    else {
      const from = [tzParam, calTz].find((z) => z && validZone(z));
      if (from && from !== tz) w = convertZone(d, t, from, tz);
    }
    row.date = w.date;
    row.time = w.time;
  } else row.error = `Start date not understood: ${v}`;
  return row;
}
