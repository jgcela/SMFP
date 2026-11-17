// Test mode (AI_MOCK): the scripted model goes through the real assistant
// path, calls the same tools as the family, cites real passages and is marked
// as simulated. A real API key always wins over the flag.
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { closeDb, withTenant } from '@/server/db/client';
import { assistantActions, directorySettings, memberships } from '@/server/db/schema';
import { loadViewer } from '@/server/viewer';
import { getAssistantModel, setAssistantModelForTests } from '@/server/ai/assistant-model';
import { aiMode, getAiProvider } from '@/server/ai/provider';
import { bestSentence, findDate, findTime, MockAiProvider, MockAssistantModel } from '@/server/ai/mock';
import { setStorageForTests, MemoryStorage } from '@/server/storage/storage';
import { createTextSource, setSourceStatus, updateAiSettings } from '@/server/services/knowledge';
import { saveStudent, setGuardian } from '@/server/services/students';
import { createFamilyRequest } from '@/server/services/inbox';
import { getConversation, sendMessage } from '@/server/services/family-assistant';
import { createSchool, createUser } from './helpers';

const MODS = ['family_accounts', 'operations_inbox', 'attendance_notices', 'knowledge_ai', 'family_assistant'];
let s: Awaited<ReturnType<typeof createSchool>>;
let n = 0;

async function family(name = 'Parent') {
  const userId = await createUser(name);
  const m = await withTenant(s.tenant.id, async (tx) => (await tx.insert(memberships).values({ tenantId: s.tenant.id, userId, kind: 'family', status: 'active' }).returning())[0]!);
  return { userId, membershipId: m.id, viewer: await loadViewer(s.tenant.id, userId) };
}
async function childOf(membershipId: string, first: string) {
  const st = await saveStudent(s.ownerCtx, null, { firstName: first, lastName: `Mock${++n}` });
  await setGuardian(s.ownerCtx, st.id, { membershipId });
  return st;
}
const last = async (p: Awaited<ReturnType<typeof family>>, conversationId: string) => (await getConversation(s.tenant.id, p.viewer, conversationId)).messages.at(-1)!;

const env = { key: process.env.ANTHROPIC_API_KEY, mock: process.env.AI_MOCK };
beforeAll(async () => {
  setStorageForTests(new MemoryStorage());
  s = await createSchool('mock-a', { enabledModules: MODS, status: 'active' });
  await withTenant(s.tenant.id, (tx) => tx.insert(directorySettings).values({ tenantId: s.tenant.id, source: 'manual' }));
  await updateAiSettings(s.ownerCtx, { familiesEnabled: false, publicEnabled: false, retentionDays: 30, storeQuestionText: true, escalationContacts: [] });
});
afterEach(() => {
  setAssistantModelForTests(undefined);
  process.env.ANTHROPIC_API_KEY = env.key;
  process.env.AI_MOCK = env.mock;
  if (env.key === undefined) delete process.env.ANTHROPIC_API_KEY;
  if (env.mock === undefined) delete process.env.AI_MOCK;
});
afterAll(async () => {
  await closeDb();
});

describe('choosing the model', () => {
  it('is off without key or flag, mock with AI_MOCK, live whenever a key is set', () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.AI_MOCK;
    expect(aiMode()).toBe('off');
    expect(getAssistantModel()).toBeNull();
    expect(getAiProvider()).toBeNull();
    process.env.AI_MOCK = 'true';
    expect(aiMode()).toBe('mock');
    expect(getAssistantModel()).toBeInstanceOf(MockAssistantModel);
    expect(getAiProvider()).toBeInstanceOf(MockAiProvider);
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    expect(aiMode()).toBe('live');
    expect(getAssistantModel()).not.toBeInstanceOf(MockAssistantModel);
  });
});

describe('helpers', () => {
  it('reads dates, times and the best sentence', () => {
    expect(findDate('He will be absent tomorrow', '2026-11-17')).toBe('2026-11-18');
    expect(findDate('Faltará el viernes', '2026-11-17')).toBe('2026-11-20');
    expect(findDate('absent on 2026-12-01', '2026-11-17')).toBe('2026-12-01');
    expect(findDate('absent', '2026-11-17')).toBeNull();
    expect(findTime('pick her up early at 1:30')).toBe('13:30');
    expect(findTime('late, arriving at 10am')).toBe('10:00');
    expect(findTime('llegará tarde, a las 9')).toBe('09:00');
    expect(bestSentence('School starts at 8 AM. Uniforms are navy and white. Lunch is at noon.', 'What color is the uniform?')).toBe('Uniforms are navy and white.');
  });
});

describe('the mock in the real assistant flow', () => {
  it('answers from approved passages with a verified citation, marked as simulated', async () => {
    setAssistantModelForTests(new MockAssistantModel());
    const src = await createTextSource(s.ownerCtx, { kind: 'faq', title: 'Uniform policy', body: 'Students wear navy pants and a white polo every day. On Fridays students may wear a spirit shirt.', visibility: 'families' });
    await setSourceStatus(s.ownerCtx, [src.id], 'approved');
    const p = await family();
    const r = await sendMessage(s.tenant.id, p.viewer, null, 'What is the uniform on Fridays?');
    const m = await last(p, r.conversationId);
    expect(m.simulated).toBe(true);
    expect(m.content).toContain('spirit shirt');
    expect(m.cards).toEqual([expect.objectContaining({ kind: 'source', title: 'Uniform policy', quote: 'On Fridays students may wear a spirit shirt.' })]);
  });

  it('says it does not know when nothing matches', async () => {
    setAssistantModelForTests(new MockAssistantModel());
    const p = await family();
    const r = await sendMessage(s.tenant.id, p.viewer, null, 'Who won the chess tournament in 1999?');
    const m = await last(p, r.conversationId);
    expect(m.content).toMatch(/couldn't find/);
    expect(m.cards).toEqual([]);
  });

  it('prepares an absence draft for the family\'s own child, asking which child when there are two', async () => {
    setAssistantModelForTests(new MockAssistantModel());
    const p = await family();
    const mia = await childOf(p.membershipId, 'Mia');
    await childOf(p.membershipId, 'Leo');
    const first = await sendMessage(s.tenant.id, p.viewer, null, 'My kid is sick and will be absent tomorrow');
    expect((await last(p, first.conversationId)).content).toMatch(/Which child.*Mia.*Leo|Which child.*Leo.*Mia/);
    const second = await sendMessage(s.tenant.id, p.viewer, first.conversationId, 'Mia');
    const m = await last(p, second.conversationId);
    const draft = m.cards.find((c) => c.kind === 'action');
    expect(draft).toBeTruthy();
    const [a] = await withTenant(s.tenant.id, (tx) => tx.select().from(assistantActions).where(eq(assistantActions.conversationId, first.conversationId)));
    expect(a).toMatchObject({ kind: 'absence_notice', status: 'proposed' });
    expect(a!.payload).toMatchObject({ studentId: `manual:${mia.id}`, type: 'absent', reason: 'illness' });
  });

  it('lists only this family\'s requests', async () => {
    setAssistantModelForTests(new MockAssistantModel());
    const p = await family();
    const other = await family('Other');
    const own = await createFamilyRequest(s.tenant.id, p.viewer, { kind: 'request', subject: 'Lost lunchbox', body: 'Green' });
    await createFamilyRequest(s.tenant.id, other.viewer, { kind: 'request', subject: 'Other family thing', body: 'x' });
    const r = await sendMessage(s.tenant.id, p.viewer, null, 'What is the status of my requests?');
    const m = await last(p, r.conversationId);
    expect(m.content).toContain(`R-${own.number} Lost lunchbox`);
    expect(m.content).not.toContain('Other family thing');
    expect(m.cards).toEqual([expect.objectContaining({ kind: 'request', id: own.id })]);
  });

  it('answers in Spanish and drafts a message to the office', async () => {
    setAssistantModelForTests(new MockAssistantModel());
    const p = await family();
    const r = await sendMessage(s.tenant.id, p.viewer, null, 'Envía un mensaje a la oficina: mi hija necesita un formulario de excursión');
    const m = await last(p, r.conversationId);
    expect(m.content).toMatch(/Preparé un mensaje/);
    expect(m.cards.some((c) => c.kind === 'action')).toBe(true);
  });
});
