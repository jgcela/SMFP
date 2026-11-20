import type { Metadata } from "next";
import { panelVars } from "../../lib/panel-theme";
import "../portal.css";
import "../admin/admin.css";
import "../admin/panel.css";
import "../admin/sunny.css";
import { loadSchoolHeader } from "../admin/school";
import { SchoolProvider } from "../admin/ui";
import { requireModule } from "../../lib/portal";

export async function generateMetadata(): Promise<Metadata> {
  const school = await loadSchoolHeader().catch(() => null);
  const mark = school?.theme.markUrl;
  return { title: "Family sign-in", robots: { index: false, follow: false }, icons: mark ? { icon: { url: mark } } : undefined };
}

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  await requireModule("families");
  const school = await loadSchoolHeader().catch(() => null);
  return (
    <body className="adm sp" style={school ? panelVars(school.theme) : undefined}>
      <SchoolProvider value={{ name: school?.name ?? "", categories: school?.theme.categories ?? {}, base: school?.base ?? "" }}>{children}</SchoolProvider>
    </body>
  );
}
