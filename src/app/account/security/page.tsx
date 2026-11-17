import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/server/request';
import { isTwoFactorRequired } from '@/server/auth/two-factor';
import { SecurityPanel } from './security-panel';
import '../../s/[tenant]/admin/admin.css';

export const metadata = { title: 'Two-step sign-in' };

/**
 * Account security: turn on two-step sign-in (authenticator app + backup
 * codes). Platform admins are sent here until they have it on.
 */
export default async function AccountSecurity({ searchParams }: { searchParams: Promise<{ required?: string }> }) {
  const session = await getSession();
  if (!session) redirect(`/login?next=${encodeURIComponent('/account/security')}`);
  const sp = await searchParams;
  const required = await isTwoFactorRequired(session.user.id);
  const enabled = !!session.user.twoFactorEnabled;
  return (
    <main id="main" className="app-page">
      <div className="card">
        <h1>Two-step sign-in</h1>
        <p className="muted" style={{ margin: 0 }}>
          Signed in as <strong>{session.user.email}</strong>
        </p>
        <SecurityPanel enabled={enabled} required={required} showRequiredNotice={required && !enabled && !!sp.required} />
        {required && enabled && (
          <p style={{ margin: 0 }}>
            <Link href="/platform">Go to the platform</Link>
          </p>
        )}
      </div>
    </main>
  );
}
