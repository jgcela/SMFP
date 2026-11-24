// Frame of the staff area: sidebar with the school and its sections (a "Menu"
// button on phones), and the page heading. The family sign-in pages still use
// the earlier header until "My family" gets its own design.
import Link from "next/link";
import { familySignOut } from "../family/actions";
import { signOut } from "./actions";
import { Icon } from "./icons";
import { loadSchoolHeader } from "./school";
import { supportVisit } from "../../lib/platform";
import { endSupport } from "../platform/actions";
import { SideNav } from "./side-nav";
import { YearPicker } from "./years/picker";
import { listYears, STATUS_LABEL } from "../../lib/years";

export type Section = "notice" | "calendar" | "documents" | "links" | "contact" | "pages" | "families" | "requests" | "volunteer" | "staff-favorites" | "wishlists" | "years" | "settings";

// module: shown only when the school has that module on (step 10).
const GROUPS: { label: string; items: { id: Section; href: string; label: string; module?: string }[] }[] = [
  {
    label: "Portal",
    items: [
      { id: "notice", href: "/admin", label: "Notice" },
      { id: "calendar", href: "/admin/calendar", label: "Calendar" },
      { id: "documents", href: "/admin/documents", label: "Documents" },
      { id: "links", href: "/admin/links", label: "Links" },
      { id: "contact", href: "/admin/contact", label: "Contact" },
      { id: "pages", href: "/admin/pages", label: "Pages" },
      { id: "volunteer", href: "/admin/volunteer", label: "Volunteer", module: "volunteer" },
      { id: "staff-favorites", href: "/admin/staff-favorites", label: "Staff favorites", module: "staff_favorites" },
      { id: "wishlists", href: "/admin/wishlists", label: "Wishlists", module: "wishlists" },
    ],
  },
  {
    label: "Families",
    items: [
      { id: "families", href: "/admin/families", label: "Families", module: "families" },
      { id: "requests", href: "/admin/requests", label: "Absences & requests", module: "requests" },
    ],
  },
  {
    label: "Account",
    items: [
      { id: "years", href: "/admin/years", label: "School years" },
      { id: "settings", href: "/admin/settings", label: "Settings" },
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

export async function AdminTop({ signedIn, section, area = "staff", familyPage = "overview" }: { signedIn: boolean; section?: Section; area?: "staff" | "family"; familyPage?: "overview" | "settings" }) {
  const school = await loadSchoolHeader();

  const { shortName, markUrl } = school.theme;
  const { base, modules, panelModules, year } = school;
  const support = area === "staff" ? await supportVisit() : null;
  const sub = area === "family" ? "Family portal" : "Staff portal";
  const out = area === "family" ? familySignOut : signOut;
  if (area === "family" && signedIn) return <FamilySide shortName={shortName} markUrl={markUrl} page={familyPage} base={base} modules={modules} />;
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
      {support && <SupportBar until={support.expiresAt} email={support.email} schoolId={support.schoolId} />}
      <aside className="sp-side">
        <div className="sp-brand">
          <Brand name={shortName} markUrl={markUrl} sub="Staff portal" />
        </div>
        {signedIn && year && <YearPicker current={year.id} years={(await listYears(school.id)).map((y) => ({ id: y.id, label: `${y.label} · ${y.status === "preparing" ? "Preparing" : STATUS_LABEL[y.status]}` }))} />}
        <SideNav menuIcon={<Icon name="menu" />} closeIcon={<Icon name="close" />}>
          <nav aria-label="Sections">
            {GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => !it.module || panelModules.includes(it.module)) })).filter((g) => g.items.length).map((g) => (
              <div key={g.label} className="sp-group">
                <p className="sp-group-l" id={`sp-g-${g.label}`}>{g.label}</p>
                <ul aria-labelledby={`sp-g-${g.label}`}>
                  {g.items.map((it) => (
                    <li key={it.id}>
                      <Link href={`${base}${it.href}`} aria-current={section === it.id ? "page" : undefined}>
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
            <a href={`${base}/`} target="_blank" rel="noopener">
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
      {signedIn && year && year.status !== "active" && <YearBar label={year.label} status={year.status} base={base} />}
    </>
  );
}

// "My family": the same frame, with the parts of the page and the families-only pages.
const FAMILY: { label: string; items: { icon: Parameters<typeof Icon>[0]["name"]; href: string; label: string; page?: "overview" | "settings"; module?: string }[] }[] = [
  {
    label: "My family",
    items: [
      { icon: "families", href: "/family", label: "Overview", page: "overview" },
      { icon: "absence", href: "/family#absence", label: "Report an absence", module: "requests" },
      { icon: "request", href: "/family#request", label: "Make a request", module: "requests" },
      { icon: "children", href: "/family#children", label: "Children" },
      { icon: "details", href: "/family#details", label: "Family details" },
      { icon: "settings", href: "/family/settings", label: "Settings", page: "settings" },
    ],
  },
  {
    label: "School",
    items: [
      { icon: "portal", href: "/", label: "Parent portal" },
      { icon: "volunteer", href: "/volunteer", label: "Volunteer", module: "volunteer" },
      { icon: "staff-favorites", href: "/staff-favorites", label: "Staff favorites", module: "staff_favorites" },
      { icon: "wishlists", href: "/wishlists", label: "Wishlists", module: "wishlists" },
    ],
  },
];

function FamilySide({ shortName, markUrl, page, base, modules }: { shortName: string; markUrl: string; page: "overview" | "settings"; base: string; modules: string[] }) {
  return (
    <>
      <a className="sp-skip" href="#main">Skip to content</a>
      <aside className="sp-side">
        <div className="sp-brand">
          <Brand name={shortName} markUrl={markUrl} sub="Family portal" />
        </div>
        <SideNav menuIcon={<Icon name="menu" />} closeIcon={<Icon name="close" />}>
          <nav aria-label="Family">
            {FAMILY.map((g) => ({ ...g, items: g.items.filter((it) => !it.module || modules.includes(it.module)) })).map((g) => (
              <div key={g.label} className="sp-group">
                <p className="sp-group-l" id={`sp-g-${g.label}`}>{g.label}</p>
                <ul aria-labelledby={`sp-g-${g.label}`}>
                  {g.items.map((it) => (
                    <li key={it.href}>
                      <a href={`${base}${it.href}`} aria-current={it.page === page ? "page" : undefined}>
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

// Step 11a: the panel is working on a year families do not see.
function YearBar({ label, status, base }: { label: string; status: string; base: string }) {
  return (
    <div className={`sp-yearbar sp-yearbar--${status}`} role="status">
      {status === "archived" ? (
        <><strong>Archived year {label}</strong> You can look at this year, but not change it. Families cannot see it.</>
      ) : (
        <><strong>Preparing {label}</strong> Families cannot see this year until you switch it on in <a href={`${base}/admin/years`}>School years</a>.</>
      )}
    </div>
  );
}

// Step 10: a FAMITENLY person is in this school's panel to help (support mode).
function SupportBar({ until, email, schoolId }: { until: Date; email: string; schoolId: number }) {
  const time = until.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Denver", timeZoneName: "short" });
  return (
    <div className="sp-support" role="status">
      <strong>Support mode</strong> FAMITENLY support ({email}) is in this staff panel with the school&rsquo;s permission, until {time}. Every change is recorded.
      <form action={endSupport} className="sp-support-end">
        <input type="hidden" name="school_id" value={schoolId} />
        <button type="submit">End support visit</button>
      </form>
    </div>
  );
}
