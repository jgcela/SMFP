import { familyContext, route } from '@/server/app-api/context';
import { myRequest } from '@/server/services/inbox';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
export const GET = route(async (req, { params }: Ctx) => {
  const c = await familyContext(req);
  const r = await myRequest(c.tenant.id, c.viewer, (await params).id);
  return {
    ...r,
    item: { ...r.item, createdAt: r.item.createdAt.toISOString() },
    events: r.events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
  };
});
