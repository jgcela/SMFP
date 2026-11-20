// Who is signed in, and which school they may edit.
// The school always comes from the address (/s/<code>, see proxy.ts) AND must be
// listed for the user in school_staff; nothing else from the browser decides it.
// Step 10: a FAMITENLY person in support mode (lib/platform.ts) also counts as
// staff of that one school, while the school allows it; everything they change
// is written to the FAMITENLY log.
import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { audit, supportVisit } from "./platform";
import { schoolSlug } from "./portal";

export type Staff = { userId: string; email: string; name: string; schoolId: number; schoolName: string; support?: boolean };

export async function currentUser() {
  const s = await auth().api.getSession({ headers: await headers() });
  return s?.user ?? null;
}

/** The signed-in user, if they are staff of this deployment's school. */
export async function currentStaff(): Promise<{ user: Awaited<ReturnType<typeof currentUser>>; staff: Staff | null }> {
  const user = await currentUser();
  if (!user) return { user: null, staff: null };
  const rows = await db()<{ school_id: number; name: string }[]>`
    select s.id as school_id, s.name from school_staff ss join schools s on s.id = ss.school_id
    where ss.user_id = ${user.id} and s.slug = ${await schoolSlug()} and s.status <> 'suspended'`;
  if (!rows.length) {
    const v = await supportVisit();
    if (v && v.userId === user.id) return { user, staff: { userId: user.id, email: user.email, name: user.name, schoolId: v.schoolId, schoolName: v.schoolName, support: true } };
    return { user, staff: null };
  }
  return { user, staff: { userId: user.id, email: user.email, name: user.name, schoolId: rows[0].school_id, schoolName: rows[0].name } };
}

// ---- Failed sign-in counter: 8 failures per email per 15 minutes ----
const MAX_FAILURES = 8;
const WINDOW_MIN = 15;

export async function tooManyFailures(key: string) {
  const [r] = await db()<{ failures: number }[]>`
    select failures from login_attempts where key = ${key} and window_start > now() - make_interval(mins => ${WINDOW_MIN})`;
  return (r?.failures ?? 0) >= MAX_FAILURES;
}

export async function recordFailure(key: string) {
  await db()`
    insert into login_attempts (key, failures, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      failures = case when login_attempts.window_start > now() - make_interval(mins => ${WINDOW_MIN}) then login_attempts.failures + 1 else 1 end,
      window_start = case when login_attempts.window_start > now() - make_interval(mins => ${WINDOW_MIN}) then login_attempts.window_start else now() end`;
}

export async function clearFailures(key: string) {
  await db()`delete from login_attempts where key = ${key}`;
}

/** For server actions: the signed-in staff member, or an error to show. */
export async function requireStaff(): Promise<Staff> {
  const { user, staff } = await currentStaff();
  if (!user) throw new Error("Your session has ended. Sign in again.");
  if (!staff) throw new Error("This account cannot edit this school’s portal.");
  if (staff.support) {
    const h = await headers();
    let page = "";
    try {
      page = new URL(h.get("referer") ?? "").pathname;
    } catch {}
    await audit({ userId: staff.userId, email: staff.email }, "support.change", staff.schoolId, `Change in the staff panel${page ? ` (${page})` : ""}`);
  }
  return staff;
}
