import { familyContext, jsonBody, route } from '@/server/app-api/context';
import { familyReply } from '@/server/services/inbox';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
export const POST = route(async (req, { params }: Ctx) => {
  const c = await familyContext(req);
  const b = await jsonBody(req);
  await familyReply(c.tenant.id, c.viewer, (await params).id, String(b.body ?? ''));
  return { ok: true };
});
