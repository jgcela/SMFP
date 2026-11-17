import { familyContext, route } from '@/server/app-api/context';
import { cancelFamilyRequest } from '@/server/services/inbox';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
export const POST = route(async (req, { params }: Ctx) => {
  const c = await familyContext(req);
  await cancelFamilyRequest(c.tenant.id, c.viewer, (await params).id);
  return { ok: true };
});
