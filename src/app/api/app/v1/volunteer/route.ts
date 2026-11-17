import { familyContext, route } from '@/server/app-api/context';
import { volunteer } from '@/server/app-api/family';

export const dynamic = 'force-dynamic';

export const GET = route(async (req) => volunteer(await familyContext(req)));
