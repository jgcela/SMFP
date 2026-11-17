// Returns a link to the file that expires after 5 minutes.
import { familyContext, route } from '@/server/app-api/context';
import { documentUrl } from '@/server/app-api/family';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ slug: string }> };
export const GET = route(async (req, { params }: Ctx) => documentUrl(await familyContext(req), (await params).slug, req.url));
