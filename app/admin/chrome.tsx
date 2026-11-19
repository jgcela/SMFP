// Header of the staff area (and of the family sign-in pages): school, sections and sign out.
import Link from "next/link";
import { familySignOut } from "../family/actions";
import { signOut } from "./actions";
import { loadSchoolHeader } from "./school";

export type Section = "notice" | "calendar" | "documents" | "links" | "contact" | "pages" | "families" | "requests" | "volunteer" | "staff-favorites" | "wishlists";

export async function AdminTop({ signedIn, section, area = "staff" }: { signedIn: boolean; section?: Section; area?: "staff" | "family" }) {
  const school = await loadSchoolHeader();
  return (
    <header className="adm-top">
      <div className="in">
        {school.logoUrl && <img src={school.logoUrl} alt="" />}
        <div className="t">
          {school.name}
          <small>{area === "family" ? "Families" : "Staff"}</small>
        </div>
        {signedIn && (
          <form action={area === "family" ? familySignOut : signOut}>
            <button type="submit">Sign out</button>
          </form>
        )}
      </div>
      {section && (
        <nav className="adm-nav" aria-label="Sections">
          <div className="in">
            <Link href="/admin" aria-current={section === "notice" ? "page" : undefined}>Notice</Link>
            <Link href="/admin/calendar" aria-current={section === "calendar" ? "page" : undefined}>Calendar</Link>
            <Link href="/admin/documents" aria-current={section === "documents" ? "page" : undefined}>Documents</Link>
            <Link href="/admin/links" aria-current={section === "links" ? "page" : undefined}>Links</Link>
            <Link href="/admin/contact" aria-current={section === "contact" ? "page" : undefined}>Contact</Link>
            <Link href="/admin/pages" aria-current={section === "pages" ? "page" : undefined}>Pages</Link>
            <Link href="/admin/volunteer" aria-current={section === "volunteer" ? "page" : undefined}>Volunteer</Link>
            <Link href="/admin/staff-favorites" aria-current={section === "staff-favorites" ? "page" : undefined}>Staff favorites</Link>
            <Link href="/admin/wishlists" aria-current={section === "wishlists" ? "page" : undefined}>Wishlists</Link>
            <Link href="/admin/families" aria-current={section === "families" ? "page" : undefined}>Families</Link>
            <Link href="/admin/requests" aria-current={section === "requests" ? "page" : undefined}>Absences &amp; requests</Link>
          </div>
        </nav>
      )}
    </header>
  );
}
