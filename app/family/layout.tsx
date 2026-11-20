import type { Metadata } from "next";
import { panelVars } from "../../lib/panel-theme";
import "../admin/admin.css";
import "../admin/panel.css";
import "../admin/sunny.css";
import { loadSchoolHeader } from "../admin/school";
import { SchoolProvider } from "../admin/ui";

export const metadata: Metadata = { title: "Family sign-in", robots: { index: false, follow: false } };

export default async function FamilyLayout({ children }: { children: React.ReactNode }) {
  const school = await loadSchoolHeader().catch(() => null);
  return (
    <body className="adm sp" style={school ? panelVars(school.theme) : undefined}>
      <SchoolProvider value={{ name: school?.name ?? "", categories: school?.theme.categories ?? {} }}>{children}</SchoolProvider>
    </body>
  );
}
