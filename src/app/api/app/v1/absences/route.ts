import { familyContext, jsonBody, route } from '@/server/app-api/context';
import { absences } from '@/server/app-api/family';
import { submitNotice } from '@/server/services/attendance';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => absences(await familyContext(req)));

export const POST = route(async (req) => {
  const c = await familyContext(req);
  const b = await jsonBody(req);
  const { notice } = await submitNotice(c.tenant.id, c.viewer, {
    studentId: b.childId,
    type: b.type,
    dateFrom: b.dateFrom,
    dateTo: b.dateTo ?? '',
    time: b.time ?? '',
    reason: b.reason,
    comment: b.comment ?? '',
    idempotencyKey: b.idempotencyKey,
  });
  return { id: notice.id, requestId: notice.inboxItemId, status: notice.status };
});
