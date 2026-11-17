import { familyContext, route } from '@/server/app-api/context';
import { deleteConversation, getConversation } from '@/server/services/family-assistant';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (req, { params }: Ctx) => {
  const c = await familyContext(req);
  const r = await getConversation(c.tenant.id, c.viewer, (await params).id);
  return {
    conversation: r.conversation,
    messages: r.messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
    actions: Object.fromEntries(Object.entries(r.actions).map(([k, a]) => [k, { ...a, createdAt: a.createdAt.toISOString() }])),
  };
});

export const DELETE = route(async (req, { params }: Ctx) => {
  const c = await familyContext(req);
  await deleteConversation(c.tenant.id, c.viewer, (await params).id);
  return { ok: true };
});
