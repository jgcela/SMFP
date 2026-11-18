// Who is signed in, and which school they may edit.
// The school always comes from this deployment (PORTAL_SCHOOL) AND must be
// listed for the user in school_staff; nothing from the browser decides it.
import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";
import { schoolSlug } from "./portal";

export type Staff = { userId: string; email: string; name: string; schoolId: number; schoolName: string };

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
    where ss.user_id = ${user.id} and s.slug = ${schoolSlug()}`;
  if (!rows.length) return { user, staff: null };
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
