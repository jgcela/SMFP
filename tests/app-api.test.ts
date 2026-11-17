// The St. Mary app API (/api/app/v1): sign-in with a bearer token (native)
// and with the session cookie (web), family-only access, one school only,
// and the family flows (announcements, absences, requests) end to end.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { auth } from '@/server/auth/auth';
import { closeDb, withTenant } from '@/server/db/client';
import { directorySettings, familyGrades, grades, memberships } from '@/server/db/schema';
import { createAnnouncement, transitionAnnouncement } from '@/server/services/content';
import { saveStudent, setGuardian } from '@/server/services/students';
import { GET as meGET } from '@/app/api/app/v1/me/route';
import { GET as annGET } from '@/app/api/app/v1/announcements/route';
import { GET as absGET, POST as absPOST } from '@/app/api/app/v1/absences/route';
import { POST as absCancel } from '@/app/api/app/v1/absences/[id]/cancel/route';
import { GET as reqGET, POST as reqPOST } from '@/app/api/app/v1/requests/route';
import { GET as reqOne } from '@/app/api/app/v1/requests/[id]/route';
import { POST as reqReply } from '@/app/api/app/v1/requests/[id]/reply/route';
import { GET as evGET } from '@/app/api/app/v1/events/route';
import { createSchool } from './helpers';

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'correct horse battery staple';
const MODULES = ['home', 'calendar', 'announcements', 'documents', 'attendance_notices', 'operations_inbox', 'family_accounts', 'quick_links', 'volunteer', 'community'];

let school: Awaited<ReturnType<typeof createSchool>>;
let other: Awaited<ReturnType<typeof createSchool>>;

async function passwordUser(email: string, name = 'Ana Rivera') {
  const ctx = await auth().$context;
  const u = await ctx.internalAdapter.createUser({ email, name, emailVerified: true }, { method: 'admin' });
  await ctx.internalAdapter.linkAccount({ userId: u.id, providerId: 'credential', accountId: u.id, password: await ctx.password.hash(PASSWORD) });
  return u.id;
}

async function addMember(s = school, userId: string, kind: 'family' | 'staff', gradeCode = '3') {
  return withTenant(s.tenant.id, async (tx) => {
    const [m] = await tx.insert(memberships).values({ tenantId: s.tenant.id, userId, kind, status: 'active' }).returning();
    if (kind === 'family') {
      const [g] = await tx.select().from(grades).where(eq(grades.code, gradeCode));
      await tx.insert(familyGrades).values({ tenantId: s.tenant.id, membershipId: m!.id, gradeId: g!.id });
    }
    return m!;
  });
}

/** Signs in like the native app and returns the bearer token. */
async function bearerFor(email: string) {
  const res = await auth().handler(
    new Request(`${ORIGIN}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: 'localhost:3000', 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.1` },
      body: JSON.stringify({ email, password: PASSWORD }),
    }),
  );
  expect(res.status).toBe(200);
  const token = res.headers.get('set-auth-token');
  expect(token).toBeTruthy();
  return token!;
}

const call = async (handler: (req: Request, ctx: never) => Promise<Response>, token: string | null, opts: { method?: string; path?: string; body?: unknown; params?: Record<string, string> } = {}) => {
  const headers: Record<string, string> = { host: 'localhost:3000' };
  if (token) headers.authorization = `Bearer ${token}`;
  if (opts.body) headers['content-type'] = 'application/json';
  const req = new Request(`${ORIGIN}/api/app/v1${opts.path ?? '/x'}`, { method: opts.method ?? 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const res = await handler(req, { params: Promise.resolve(opts.params ?? {}) } as never);
  return { status: res.status, json: await res.json() };
};

let familyToken: string;
let childKey: string;

beforeAll(async () => {
  school = await createSchool('app-a', { enabledModules: MODULES, status: 'active' });
  other = await createSchool('app-b', { enabledModules: MODULES, status: 'active' });
  process.env.APP_TENANT_KEY = school.tenant.slug;
  await withTenant(school.tenant.id, (tx) => tx.insert(directorySettings).values({ tenantId: school.tenant.id, source: 'manual' }));

  const email = `family-${randomUUID().slice(0, 8)}@example.test`;
  const userId = await passwordUser(email);
  const m = await addMember(school, userId, 'family');
  const [g] = await withTenant(school.tenant.id, (tx) => tx.select().from(grades).where(eq(grades.code, '3')));
  const st = await saveStudent(school.ownerCtx, null, { firstName: 'Carmen', lastName: 'Rivera', gradeId: g!.id });
  await setGuardian(school.ownerCtx, st.id, { membershipId: m.id });
  childKey = `manual:${st.id}`;
  familyToken = await bearerFor(email);
});

afterAll(async () => {
  delete process.env.APP_TENANT_KEY;
  await closeDb();
});

describe('app api access', () => {
  it('needs a session', async () => {
    const r = await call(meGET, null);
    expect(r.status).toBe(401);
  });

  it('refuses staff and families of another school', async () => {
    const staffEmail = `staff-${randomUUID().slice(0, 8)}@example.test`;
    await addMember(school, await passwordUser(staffEmail, 'Office'), 'staff');
    expect((await call(meGET, await bearerFor(staffEmail))).json.code).toBe('staff');

    const otherEmail = `other-${randomUUID().slice(0, 8)}@example.test`;
    await addMember(other, await passwordUser(otherEmail), 'family');
    const r = await call(meGET, await bearerFor(otherEmail));
    expect(r.status).toBe(403);
    expect(r.json.code).toBe('not_family');
  });

  it('returns the family, the school and the linked child', async () => {
    const r = await call(meGET, familyToken);
    expect(r.status).toBe(200);
    expect(r.json.user.name).toBe('Ana Rivera');
    expect(r.json.children).toEqual([expect.objectContaining({ id: childKey, firstName: 'Carmen', canReportAbsence: true })]);
    expect(r.json.features).toMatchObject({ absences: true, requests: true, ask: false });
  });
});

describe('app api data', () => {
  it('lists published announcements only', async () => {
    const pub = await createAnnouncement(school.ownerCtx, { title: 'Field trip', body: 'Pack a lunch.', isUrgent: true });
    await transitionAnnouncement(school.ownerCtx, pub.id, 'publish');
    await createAnnouncement(school.ownerCtx, { title: 'Draft only', body: 'x' });
    const r = await call(annGET, familyToken);
    expect(r.json.map((a: { title: string }) => a.title)).toEqual(['Field trip']);
    expect(r.json[0].important).toBe(true);
  });

  it('lists calendar events for a date range', async () => {
    const r = await call(evGET, familyToken, { path: '/events?from=2026-11-01&to=2026-11-30' });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.json.events)).toBe(true);
  });

  it('sends, lists and cancels an absence notice', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: school.tenant.timezone }).format(new Date());
    const sent = await call(absPOST, familyToken, { method: 'POST', body: { childId: childKey, type: 'absent', dateFrom: today, reason: 'illness', idempotencyKey: randomUUID() } });
    expect(sent.status).toBe(200);
    const list = await call(absGET, familyToken);
    expect(list.json[0]).toMatchObject({ id: sent.json.id, childName: 'Carmen Rivera', type: 'absent', dateFrom: today });
    const cancel = await call(absCancel, familyToken, { method: 'POST', params: { id: sent.json.id } });
    expect(cancel.status).toBe(200);
    expect((await call(absGET, familyToken)).json[0].status).toBe('cancelled');
  });

  it('refuses an absence for a child that is not theirs', async () => {
    const r = await call(absPOST, familyToken, { method: 'POST', body: { childId: `manual:${randomUUID()}`, type: 'absent', dateFrom: '2026-11-20', reason: 'illness', idempotencyKey: randomUUID() } });
    expect(r.status).toBe(422);
  });

  it('creates a request, reads it and replies', async () => {
    const created = await call(reqPOST, familyToken, { method: 'POST', body: { kind: 'question', subject: 'Pickup on Friday', body: 'Grandma will pick up Carmen.', childId: childKey } });
    expect(created.status).toBe(200);
    const one = await call(reqOne, familyToken, { params: { id: created.json.id } });
    expect(one.json.item.subject).toBe('Pickup on Friday');
    expect((await call(reqReply, familyToken, { method: 'POST', params: { id: created.json.id }, body: { body: 'Thanks!' } })).status).toBe(200);
    const list = await call(reqGET, familyToken);
    expect(list.json.some((r: { id: string }) => r.id === created.json.id)).toBe(true);
  });
});
