import { familyContext, route } from '@/server/app-api/context';
import { listConversations } from '@/server/services/family-assistant';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const c = await familyContext(req);
  return (await listConversations(c.tenant.id, c.viewer)).map((x) => ({ ...x, updatedAt: x.updatedAt.toISOString() }));
});
