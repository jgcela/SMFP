import type { Metadata } from "next";
import { panelVars } from "../../lib/panel-theme";
import "./admin.css";
import "./panel.css";
import { loadSchoolHeader } from "./school";

export const metadata: Metadata = { title: "Staff sign-in", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const school = await loadSchoolHeader().catch(() => null);
  return (
    <body className="adm sp" style={school ? panelVars(school.theme) : undefined}>
      {children}
    </body>
  );
}
