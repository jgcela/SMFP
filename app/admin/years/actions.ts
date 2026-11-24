"use server";
// School years (step 11a): pick the year the panel works on, create the next
// year, change a year's name and dates, move children up a grade and switch
// the new year on. Every action checks the signed-in staff member's school.
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "../../../lib/db";
import { requireStaff } from "../../../lib/staff";
import { activateYear, createYear, LEAVES, savePromotion, type PromotionRow } from "../../../lib/year-ops";
import { yearCookie } from "../../../lib/years";

export type YearState = { ok?: string; error?: string; field?: string } | undefined;

const fail = (err: unknown, fallback: string): YearState => ({ error: err instanceof Error ? err.message : fallback });
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function refreshAll() {
  revalidatePath("/", "layout");
}

/** The year the staff panel works on (a preference kept in a cookie). */
export async function pickYear(fd: FormData): Promise<void> {
  const staff = await requireStaff();
  const id = Number(fd.get("year_id") ?? 0);
  const [y] = await db()<{ id: number; status: string }[]>`select id, status from school_years where id = ${id} and school_id = ${staff.schoolId}`;
  if (!y) return;
  const jar = await cookies();
  if (y.status === "active") jar.delete(yearCookie(staff.schoolId));
  else jar.set(yearCookie(staff.schoolId), String(y.id), { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30 });
  refreshAll();
}

function readYear(fd: FormData) {
  const label = String(fd.get("label") ?? "").replace(/\s+/g, " ").trim();
  const startsOn = String(fd.get("starts_on") ?? "");
  const endsOn = String(fd.get("ends_on") ?? "");
  if (!label) return { error: "Write the name of the school year, for example 2027–28.", field: "label" };
  if (label.length > 30) return { error: "Use at most 30 characters for the name.", field: "label" };
  if (!ISO.test(startsOn) || Number.isNaN(Date.parse(startsOn))) return { error: "Choose the first day of the year.", field: "starts_on" };
  if (!ISO.test(endsOn) || Number.isNaN(Date.parse(endsOn))) return { error: "Choose the last day of the year.", field: "ends_on" };
  if (endsOn <= startsOn) return { error: "The last day must be after the first day.", field: "ends_on" };
  return { label, startsOn, endsOn };
}

export async function addYear(_prev: YearState, fd: FormData): Promise<YearState> {
  try {
    const staff = await requireStaff();
    const v = readYear(fd);
    if ("error" in v) return v;
    const copy = fd.get("start") === "copy";
    if (!copy && fd.get("start") !== "scratch") return { error: "Choose how to start the new year.", field: "start" };
    const [busy] = await db()<{ label: string }[]>`select label from school_years where school_id = ${staff.schoolId} and status = 'preparing'`;
    if (busy) return { error: `${busy.label} is already being prepared. Switch it on before creating another year.` };
    const [taken] = await db()`select 1 from school_years where school_id = ${staff.schoolId} and lower(label) = lower(${v.label})`;
    if (taken) return { error: "There is already a school year with this name.", field: "label" };
    const [overlap] = await db()<{ label: string }[]>`
      select label from school_years where school_id = ${staff.schoolId} and starts_on <= ${v.endsOn} and ends_on >= ${v.startsOn}`;
    if (overlap) return { error: `These dates overlap ${overlap.label}. Choose dates after it ends.`, field: "starts_on" };
    const id = await createYear(staff.schoolId, { ...v, copy, by: staff.name || staff.email });
    // Go straight to the new year, to fill it in.
    (await cookies()).set(yearCookie(staff.schoolId), String(id), { path: "/", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 30 });
    refreshAll();
    return { ok: `${v.label} created${copy ? " as a copy" : " empty"}. Families cannot see it yet. The panel now shows ${v.label}.` };
  } catch (err) {
    return fail(err, "Could not create the school year.");
  }
}

export async function editYear(_prev: YearState, fd: FormData): Promise<YearState> {
  try {
    const staff = await requireStaff();
    const id = Number(fd.get("id") ?? 0);
    const v = readYear(fd);
    if ("error" in v) return v;
    const [taken] = await db()`select 1 from school_years where school_id = ${staff.schoolId} and lower(label) = lower(${v.label}) and id <> ${id}`;
    if (taken) return { error: "There is already a school year with this name.", field: "label" };
    const [overlap] = await db()<{ label: string }[]>`
      select label from school_years where school_id = ${staff.schoolId} and id <> ${id} and starts_on <= ${v.endsOn} and ends_on >= ${v.startsOn}`;
    if (overlap) return { error: `These dates overlap ${overlap.label}.`, field: "starts_on" };
    const r = await db()`
      update school_years set label = ${v.label}, starts_on = ${v.startsOn}, ends_on = ${v.endsOn}
      where id = ${id} and school_id = ${staff.schoolId}`;
    if (!r.count) return { error: "This school year no longer exists. Reload the page." };
    refreshAll();
    return { ok: "Saved." };
  } catch (err) {
    return fail(err, "Could not save the school year.");
  }
}

export async function switchOn(_prev: YearState, fd: FormData): Promise<YearState> {
  try {
    const staff = await requireStaff();
    if (staff.support) return { error: "Only the school's own staff can switch a year on." };
    const id = Number(fd.get("id") ?? 0);
    const [y] = await db()<{ label: string }[]>`select label from school_years where id = ${id} and school_id = ${staff.schoolId} and status = 'preparing'`;
    if (!y) return { error: "Only a year being prepared can be switched on. Reload the page." };
    if (String(fd.get("confirm") ?? "").trim() !== y.label) return { error: `Type ${y.label} to confirm.`, field: "confirm" };
    await activateYear(staff.schoolId, id);
    (await cookies()).delete(yearCookie(staff.schoolId));
    refreshAll();
    return { ok: `${y.label} is now the active year. Families see it from now on.` };
  } catch (err) {
    return fail(err, "Could not switch the year on.");
  }
}

export async function saveGrades(_prev: YearState, fd: FormData): Promise<YearState> {
  try {
    const staff = await requireStaff();
    const grades = String(fd.get("grades") ?? "").split(/\r?\n/).map((g) => g.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!grades.length) return { error: "Write at least one grade, one per line.", field: "grades" };
    if (grades.length > 30 || grades.some((g) => g.length > 40)) return { error: "Use at most 30 grades of up to 40 characters.", field: "grades" };
    if (new Set(grades.map((g) => g.toLowerCase())).size !== grades.length) return { error: "A grade is written twice.", field: "grades" };
    await db()`update schools set grades = ${db().json(grades)} where id = ${staff.schoolId}`;
    revalidatePath("/admin/years/grades");
    return { ok: "Grades saved. The list of children now uses them." };
  } catch (err) {
    return fail(err, "Could not save the grades.");
  }
}

export async function moveUp(_prev: YearState, fd: FormData): Promise<YearState> {
  try {
    const staff = await requireStaff();
    const yearId = Number(fd.get("year_id") ?? 0);
    const ids = fd.getAll("child").map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (!ids.length) return { error: "There are no children to move up." };
    const rows: PromotionRow[] = [];
    for (const id of ids) {
      const choice = String(fd.get(`grade_${id}`) ?? "").trim();
      if (!choice) return { error: "Choose a grade for every child, or “Leaves the school”." };
      if (choice.length > 40) return { error: "A grade is too long." };
      rows.push(choice === LEAVES ? { childId: id, grade: "", leaves: true } : { childId: id, grade: choice, leaves: false });
    }
    await savePromotion(staff.schoolId, yearId, rows);
    revalidatePath("/admin/years");
    revalidatePath("/admin/families", "layout");
    return { ok: `Saved the grades of ${rows.length} ${rows.length === 1 ? "child" : "children"}.` };
  } catch (err) {
    return fail(err, "Could not save the grades.");
  }
}
