// The family pressed Send (decision "confirm") or Discard on a draft the assistant prepared.
import { ApiError, familyContext, jsonBody, route } from '@/server/app-api/context';
import { confirmAction, dismissAction } from '@/server/services/family-assistant';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
export const POST = route(async (req, { params }: Ctx) => {
  const c = await familyContext(req);
  const { decision } = await jsonBody(req);
  const id = (await params).id;
  if (decision === 'confirm') return confirmAction(c.tenant.id, c.viewer, id);
  if (decision === 'dismiss') {
    await dismissAction(c.tenant.id, c.viewer, id);
    return { ok: true };
  }
  throw new ApiError(400, 'Unknown decision.', 'bad_request');
});
