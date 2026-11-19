// Frame of the staff area: sidebar with the school and its sections (a "Menu"
// button on phones), and the page heading. The family sign-in pages still use
// the earlier header until "My family" gets its own design.
import Link from "next/link";
import { familySignOut } from "../family/actions";
import { signOut } from "./actions";
import { Icon } from "./icons";
import { loadSchoolHeader } from "./school";
import { SideNav } from "./side-nav";

export type Section = "notice" | "calendar" | "documents" | "links" | "contact" | "pages" | "families" | "requests" | "volunteer" | "staff-favorites" | "wishlists";

const GROUPS: { label: string; items: { id: Section; href: string; label: string }[] }[] = [
  {
    label: "Portal",
    items: [
      { id: "notice", href: "/admin", label: "Notice" },
      { id: "calendar", href: "/admin/calendar", label: "Calendar" },
      { id: "documents", href: "/admin/documents", label: "Documents" },
      { id: "links", href: "/admin/links", label: "Links" },
      { id: "contact", href: "/admin/contact", label: "Contact" },
      { id: "pages", href: "/admin/pages", label: "Pages" },
      { id: "volunteer", href: "/admin/volunteer", label: "Volunteer" },
      { id: "staff-favorites", href: "/admin/staff-favorites", label: "Staff favorites" },
      { id: "wishlists", href: "/admin/wishlists", label: "Wishlists" },
    ],
  },
  {
    label: "Families",
    items: [
      { id: "families", href: "/admin/families", label: "Families" },
      { id: "requests", href: "/admin/requests", label: "Absences & requests" },
    ],
  },
];

function Brand({ name, markUrl, sub }: { name: string; markUrl: string; sub: string }) {
  return (
    <div className="sp-brand-id">
      {markUrl && <img src={markUrl} alt="" width={44} height={44} />}
      <span>
        <strong>{name}</strong>
        <small>{sub}</small>
      </span>
    </div>
  );
}

export async function AdminTop({ signedIn, section, area = "staff" }: { signedIn: boolean; section?: Section; area?: "staff" | "family" }) {
  const school = await loadSchoolHeader();

  const { shortName, markUrl } = school.theme;
  const sub = area === "family" ? "Family portal" : "Staff portal";
  const out = area === "family" ? familySignOut : signOut;
  if (area === "family" && signedIn) return <FamilySide shortName={shortName} markUrl={markUrl} />;
  if (!section) {
    // Sign-in, password and "no access" screens: only the school, no sections.
    return (
      <header className="sp-solo">
        <Brand name={shortName} markUrl={markUrl} sub={sub} />
        {signedIn && (
          <form action={out}>
            <button type="submit" className="sp-out">
              <Icon name="signout" />
              Sign out
            </button>
          </form>
        )}
      </header>
    );
  }

  return (
    <>
      <a className="sp-skip" href="#main">Skip to content</a>
      <aside className="sp-side">
        <div className="sp-brand">
          <Brand name={shortName} markUrl={markUrl} sub="Staff portal" />
        </div>
        <SideNav menuIcon={<Icon name="menu" />} closeIcon={<Icon name="close" />}>
          <nav aria-label="Sections">
            {GROUPS.map((g) => (
              <div key={g.label} className="sp-group">
                <p className="sp-group-l" id={`sp-g-${g.label}`}>{g.label}</p>
                <ul aria-labelledby={`sp-g-${g.label}`}>
                  {g.items.map((it) => (
                    <li key={it.id}>
                      <Link href={it.href} aria-current={section === it.id ? "page" : undefined}>
                        <Icon name={it.id} />
                        {it.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="sp-foot">
            <a href="/" target="_blank" rel="noopener">
              <Icon name="external" />
              Open family portal
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            {signedIn && (
              <form action={signOut}>
                <button type="submit" className="sp-out">
                  <Icon name="signout" />
                  Sign out
                </button>
              </form>
            )}
          </div>
        </SideNav>
      </aside>
    </>
  );
}

// "My family": the same frame, with the parts of the page and the families-only pages.
const FAMILY: { label: string; items: { icon: Parameters<typeof Icon>[0]["name"]; href: string; label: string; current?: boolean }[] }[] = [
  {
    label: "My family",
    items: [
      { icon: "families", href: "/family", label: "Overview", current: true },
      { icon: "absence", href: "/family#absence", label: "Report an absence" },
      { icon: "request", href: "/family#request", label: "Make a request" },
      { icon: "children", href: "/family#children", label: "Children" },
      { icon: "details", href: "/family#details", label: "Family details" },
    ],
  },
  {
    label: "School",
    items: [
      { icon: "portal", href: "/", label: "Parent portal" },
      { icon: "volunteer", href: "/volunteer", label: "Volunteer" },
      { icon: "staff-favorites", href: "/staff-favorites", label: "Staff favorites" },
      { icon: "wishlists", href: "/wishlists", label: "Wishlists" },
    ],
  },
];

function FamilySide({ shortName, markUrl }: { shortName: string; markUrl: string }) {
  return (
    <>
      <a className="sp-skip" href="#main">Skip to content</a>
      <aside className="sp-side">
        <div className="sp-brand">
          <Brand name={shortName} markUrl={markUrl} sub="Family portal" />
        </div>
        <SideNav menuIcon={<Icon name="menu" />} closeIcon={<Icon name="close" />}>
          <nav aria-label="Family">
            {FAMILY.map((g) => (
              <div key={g.label} className="sp-group">
                <p className="sp-group-l" id={`sp-g-${g.label}`}>{g.label}</p>
                <ul aria-labelledby={`sp-g-${g.label}`}>
                  {g.items.map((it) => (
                    <li key={it.href}>
                      <a href={it.href} aria-current={it.current ? "page" : undefined}>
                        <Icon name={it.icon} />
                        {it.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="sp-foot">
            <form action={familySignOut}>
              <button type="submit" className="sp-out">
                <Icon name="signout" />
                Sign out
              </button>
            </form>
          </div>
        </SideNav>
      </aside>
    </>
  );
}

// Heading of a staff screen: school name, title, one line, and the screen's buttons.
export async function PageHead({ title, lead, actions }: { title: string; lead?: React.ReactNode; actions?: React.ReactNode }) {
  const school = await loadSchoolHeader();
  return (
    <div className="sp-head">
      <div className="sp-head-t">
        <p className="sp-eyebrow">{school.name}</p>
        <h1>{title}</h1>
        {lead && <p className="sp-lead">{lead}</p>}
      </div>
      {actions && <div className="sp-head-a">{actions}</div>}
    </div>
  );
}
