// Families use one interface everywhere: the St. Mary app (Expo), served at the
// site root on the web. The older portal pages under /s/<school>/… send people
// to the matching app screen instead of showing a second, different design.
// Kept on the server: the office admin, staff invitations, file links (/d/…)
// and calendar downloads (…/ics). Families join through an office invitation.

const FIXED: Record<string, string> = {
  '': '/',
  login: '/sign-in',
  account: '/family/settings',
  settings: '/family/settings',
  family: '/family',
  calendar: '/calendar',
  updates: '/home',
  documents: '/family/documents',
  community: '/family/community',
  volunteer: '/family/volunteer',
  p: '/family/contact',
  ask: '/ask',
  assistant: '/ask',
  absence: '/report-absence',
  requests: '/inbox',
  join: '/',
};

/** The app path for a portal path after /s/<school>, or null to keep the page. */
export function appPathFor(rest: string): string | null {
  const parts = rest.split('/').filter(Boolean);
  const head = parts[0] ?? '';
  if (parts.length <= 1) return FIXED[head] ?? null;
  const id = parts[1]!;
  if (head === 'updates' && parts.length === 2) return `/home/announcement/${encodeURIComponent(id)}`;
  if (head === 'requests' && parts.length === 2) return `/inbox/request/${encodeURIComponent(id)}`;
  if (head === 'p' && parts.length === 2) return '/family/contact';
  if (head === 'calendar' && parts[1] === 'event' && parts.length === 3) return '/calendar';
  return null;
}

/** Sign-in pages (school and platform) open the app's sign-in, keeping where to go next. */
export function appRedirect(pathname: string, search: URLSearchParams): string | null {
  let target: string | null = null;
  if (pathname === '/login' || pathname === '/school-login') target = '/sign-in';
  else {
    const m = /^\/s\/[^/]+(\/.*)?$/.exec(pathname);
    if (m) target = appPathFor(m[1] ?? '');
  }
  if (!target) return null;
  const keep = new URLSearchParams();
  if (target === '/sign-in') {
    const next = search.get('next');
    if (next && next.startsWith('/') && !next.startsWith('//')) keep.set('next', next);
    if (search.get('error')) keep.set('error', search.get('error')!);
  }
  const q = keep.toString();
  return q ? `${target}?${q}` : target;
}
