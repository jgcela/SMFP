import { familyContext, jsonBody, route } from '@/server/app-api/context';
import { createFamilyRequest, myRequests } from '@/server/services/inbox';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const c = await familyContext(req);
  const rows = await myRequests(c.tenant.id, c.viewer);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }));
});

export const POST = route(async (req) => {
  const c = await familyContext(req);
  const b = await jsonBody(req);
  const item = await createFamilyRequest(c.tenant.id, c.viewer, { kind: b.kind ?? 'request', subject: b.subject, body: b.body, studentId: b.childId || undefined });
  return { id: item.id, number: item.number };
});
