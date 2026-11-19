// "My family" (step 6a): labels and checks shared by the family page, the staff
// area and the server. No school data here.

export type SubmissionKind = "absence" | "request";
export type SubmissionStatus = "received" | "in_progress" | "resolved";

export const ABSENCE_REASONS = { sick: "Illness", medical: "Medical appointment", family: "Family reason", other: "Other" } as const;
export const REQUEST_TYPES = { early_pickup: "Early pick-up", transportation: "Transportation change", meeting: "Meeting", other: "Other" } as const;
export const STATUS_LABEL: Record<SubmissionStatus, string> = { received: "Received", in_progress: "In progress", resolved: "Resolved" };
export const KIND_LABEL: Record<SubmissionKind, string> = { absence: "Absence", request: "Request" };

export const categoryLabel = (kind: SubmissionKind, category: string) =>
  (kind === "absence" ? (ABSENCE_REASONS as Record<string, string>) : (REQUEST_TYPES as Record<string, string>))[category] ?? category;

/** Suggestions for the grade field (families may type something else). */
export const GRADE_SUGGESTIONS = ["Preschool", "Kindergarten", "1st grade", "2nd grade", "3rd grade", "4th grade", "5th grade", "6th grade", "7th grade", "8th grade"];

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const day = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const DAY = 86_400_000;

/** A date typed in a form: a real calendar day, within about a month back and a year ahead. */
export function checkDate(raw: string, what = "the date"): string | null {
  if (!ISO.test(raw)) return `Choose ${what}.`;
  const d = day(raw);
  if (new Date(d).toISOString().slice(0, 10) !== raw) return `Choose ${what}: that day does not exist.`;
  const today = Date.now() - (Date.now() % DAY);
  if (d < today - 31 * DAY) return `${what[0].toUpperCase()}${what.slice(1)} is more than a month ago.`;
  if (d > today + 366 * DAY) return `${what[0].toUpperCase()}${what.slice(1)} is more than a year away.`;
  return null;
}

export function checkRange(from: string, to: string): string | null {
  const e = checkDate(from, "the first day") ?? checkDate(to, "the last day");
  if (e) return e;
  if (day(to) < day(from)) return "The last day is before the first day.";
  if (day(to) - day(from) > 60 * DAY) return "An absence can be at most 60 days long. Send two if you need more.";
  return null;
}

/** "Nov 20" or "Nov 20 – Nov 22" (dates as stored, no time zone shift). */
export function formatRange(from: string, to: string) {
  const f = (s: string) => new Date(day(s)).toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short", timeZone: "UTC" });
  return from === to ? f(from) : `${f(from)} – ${f(to)}`;
}

/** Today's date (YYYY-MM-DD) in a time zone, e.g. the school's. */
export function todayIn(tz: string, plusDays = 0) {
  const d = new Date(Date.now() + plusDays * DAY);
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export type SubmissionRow = {
  id: number; kind: SubmissionKind; category: string; childName: string; dateFrom: string; dateTo: string;
  message: string; status: SubmissionStatus; createdAt: string; statusAt: string | null;
};

/** "Nov 19, 3:05 PM" in the school's time zone, from a timestamptz as text. */
export function when(iso: string, tz: string) {
  const d = new Date(iso.replace(" ", "T").replace(/(\+\d\d)$/, "$1:00"));
  const o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  try { return d.toLocaleString("en-US", { ...o, timeZone: tz }); } catch { return d.toLocaleString("en-US", o); }
}
