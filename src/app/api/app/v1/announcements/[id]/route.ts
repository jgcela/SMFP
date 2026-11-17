import { familyContext, route } from '@/server/app-api/context';
import { announcement } from '@/server/app-api/family';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };
export const GET = route(async (req, { params }: Ctx) => announcement(await familyContext(req), (await params).id));
