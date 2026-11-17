import { describe, expect, it } from 'vitest';
import { appRedirect } from '../src/server/tenancy/app-redirects';

const go = (path: string) => {
  const u = new URL(path, 'https://x.test');
  return appRedirect(u.pathname, u.searchParams);
};

describe('portal pages open the app', () => {
  it('maps family pages to app screens', () => {
    expect(go('/s/stmary')).toBe('/');
    expect(go('/s/stmary/')).toBe('/');
    expect(go('/s/stmary/calendar')).toBe('/calendar');
    expect(go('/s/stmary/updates/abc')).toBe('/home/announcement/abc');
    expect(go('/s/stmary/requests/r1')).toBe('/inbox/request/r1');
    expect(go('/s/stmary/documents')).toBe('/family/documents');
    expect(go('/s/stmary/absence')).toBe('/report-absence');
    expect(go('/s/stmary/join')).toBe('/');
  });

  it('sends sign-in to the app and keeps a safe next', () => {
    expect(go('/s/stmary/login?next=%2Fs%2Fstmary%2Fadmin')).toBe('/sign-in?next=%2Fs%2Fstmary%2Fadmin');
    expect(go('/login?next=/platform')).toBe('/sign-in?next=%2Fplatform');
    expect(go('/school-login')).toBe('/sign-in');
    expect(go('/s/stmary/login?next=//evil.test')).toBe('/sign-in');
    expect(go('/s/stmary/login?error=forbidden')).toBe('/sign-in?error=forbidden');
  });

  it('keeps the admin, invitations, files and calendar downloads', () => {
    for (const p of ['/s/stmary/admin', '/s/stmary/admin/families', '/s/stmary/invite/t', '/s/stmary/d/file', '/s/stmary/calendar/event/e1/ics', '/platform', '/account/security']) {
      expect(go(p)).toBeNull();
    }
  });
});
