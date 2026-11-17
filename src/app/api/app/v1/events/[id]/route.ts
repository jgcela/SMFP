import { familyContext, route } from '@/server/app-api/context';
import { event } from '@/server/app-api/family';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
export const GET = route(async (req, { params }: Ctx) => event(await familyContext(req), (await params).id));
