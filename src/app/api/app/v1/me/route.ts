import { familyContext, route } from '@/server/app-api/context';
import { me } from '@/server/app-api/family';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => me(await familyContext(req)));
