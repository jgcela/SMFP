import type { Metadata } from "next";
import { panelVars } from "../../lib/panel-theme";
import "./admin.css";
import "./panel.css";
import "./sunny.css";
import "../platform/platform.css";
import { loadSchoolHeader } from "./school";
import { SchoolProvider } from "./ui";

export async function generateMetadata(): Promise<Metadata> {
  const school = await loadSchoolHeader().catch(() => null);
  const mark = school?.theme.markUrl;
  return { title: "Staff sign-in", robots: { index: false, follow: false }, icons: mark ? { icon: { url: mark } } : undefined };
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const school = await loadSchoolHeader().catch(() => null);
  return (
    <body className="adm sp" style={school ? panelVars(school.theme) : undefined}>
      <SchoolProvider value={{ name: school?.name ?? "", categories: school?.theme.categories ?? {}, base: school?.base ?? "" }}>{children}</SchoolProvider>
    </body>
  );
}
