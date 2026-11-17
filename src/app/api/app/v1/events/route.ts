import { familyContext, route } from '@/server/app-api/context';
import { events } from '@/server/app-api/family';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  const u = new URL(req.url);
  return events(await familyContext(req), u.searchParams.get('from'), u.searchParams.get('to'));
});
