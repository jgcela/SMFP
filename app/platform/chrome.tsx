// Frame of FAMITENLY's panel: sidebar like the schools' staff panels.
import Link from "next/link";
import { Icon } from "../admin/icons";
import { SideNav } from "../admin/side-nav";
import { platformSignOut } from "./actions";

type Page = "schools" | "new" | "log" | "account";
const NAV: { id: Page; href: string; label: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
  { id: "schools", href: "/platform", label: "Schools", icon: "families" },
  { id: "new", href: "/platform/schools/new", label: "New school", icon: "plus" },
  { id: "log", href: "/platform/log", label: "Activity log", icon: "documents" },
  { id: "account", href: "/platform/account", label: "Your account", icon: "settings" },
];

function Brand({ sub }: { sub: string }) {
  return (
    <div className="sp-brand-id">
      <span className="pf-mark" aria-hidden="true">F</span>
      <span>
        <strong>FAMITENLY</strong>
        <small>{sub}</small>
      </span>
    </div>
  );
}

export function PlatformSide({ page, email }: { page?: Page; email: string }) {
  return (
    <>
      <a className="sp-skip" href="#main">Skip to content</a>
      <aside className="sp-side">
        <div className="sp-brand"><Brand sub="Super Admin" /></div>
        <SideNav menuIcon={<Icon name="menu" />} closeIcon={<Icon name="close" />}>
          <nav aria-label="FAMITENLY">
            <div className="sp-group">
              <p className="sp-group-l" id="pf-g">Platform</p>
              <ul aria-labelledby="pf-g">
                {NAV.map((n) => (
                  <li key={n.id}>
                    <Link href={n.href} aria-current={page === n.id ? "page" : undefined}><Icon name={n.icon} />{n.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
          <div className="sp-foot">
            <p className="sp-note" style={{ margin: "0 0 8px" }}>{email}</p>
            <form action={platformSignOut}>
              <button type="submit" className="sp-out"><Icon name="signout" />Sign out</button>
            </form>
          </div>
        </SideNav>
      </aside>
    </>
  );
}

/** Sign-in and two-step screens: only the name, no sections. */
export function PlatformSolo({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sp-solo">
      <Brand sub="Super Admin" />
      {signedIn && (
        <form action={platformSignOut}>
          <button type="submit" className="sp-out"><Icon name="signout" />Sign out</button>
        </form>
      )}
    </header>
  );
}

export function PlatformHead({ title, lead, actions, back }: { title: string; lead?: React.ReactNode; actions?: React.ReactNode; back?: React.ReactNode }) {
  return (
    <div className="sp-head">
      <div className="sp-head-t">
        {back && <p className="sp-back">{back}</p>}
        <p className="sp-eyebrow">FAMITENLY</p>
        <h1>{title}</h1>
        {lead && <p className="sp-lead">{lead}</p>}
      </div>
      {actions && <div className="sp-head-a">{actions}</div>}
    </div>
  );
}
