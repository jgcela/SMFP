import { familyContext, route } from '@/server/app-api/context';
import { announcements } from '@/server/app-api/family';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => announcements(await familyContext(req)));
