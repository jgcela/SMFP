import { familyContext, route } from '@/server/app-api/context';
import { links } from '@/server/app-api/family';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => links(await familyContext(req), new URL(req.url).origin));
