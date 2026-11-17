import { familyContext, route } from '@/server/app-api/context';
import { cancelNotice } from '@/server/services/attendance';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
export const POST = route(async (req, { params }: Ctx) => {
  const c = await familyContext(req);
  await cancelNotice(c.tenant.id, c.viewer, (await params).id);
  return { ok: true };
});
