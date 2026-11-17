import { getDisplayView, getTenantOr404 } from '@/server/request';
import { themeToCss } from '@/server/theme/tokens';

// Staff invitations use the app's look: the school mark and a card on the
// grouped background, no public-portal header.
export default async function InviteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tenant: string }> }) {
  const tenant = await getTenantOr404((await params).tenant);
  const view = await getDisplayView(tenant.id);
  const name = view.profile.shortName ?? view.profile.displayName;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: themeToCss(view.theme) }} />
      <main id="main" className="app-page">
        <div style={{ width: '100%', maxWidth: 480, display: 'grid', gap: 16 }}>
          <div className="app-brand">
            <span className="app-mark" aria-hidden="true">
              {name
                .split(/\s+/)
                .filter((w) => /^[A-Z]/.test(w))
                .slice(0, 2)
                .map((w) => w[0])
                .join('') || 'SM'}
            </span>
            <span className="app-brand-name">{view.profile.displayName}</span>
          </div>
          {children}
        </div>
      </main>
    </>
  );
}
