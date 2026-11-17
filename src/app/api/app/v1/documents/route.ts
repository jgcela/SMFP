import { familyContext, route } from '@/server/app-api/context';
import { documents } from '@/server/app-api/family';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => documents(await familyContext(req)));
