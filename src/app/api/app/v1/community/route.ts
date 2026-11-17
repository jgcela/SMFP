import { familyContext, route } from '@/server/app-api/context';
import { community } from '@/server/app-api/family';

export const dynamic = 'force-dynamic';

// ?kind=wishlist (teacher wishlists, default) or ?kind=favorites (staff favorites)
export const GET = route(async (req) => {
  const kind = new URL(req.url).searchParams.get('kind') === 'favorites' ? 'favorites' : 'wishlist';
  return community(await familyContext(req), kind);
});
