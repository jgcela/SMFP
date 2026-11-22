import type { Metadata } from "next";
import { LookSwitcher } from "../look";
import { panelVars, readPanelTheme } from "../../lib/panel-theme";
import "../portal.css";
import "../admin/admin.css";
import "../admin/panel.css";
import "../admin/sunny.css";
import "./platform.css";

// FAMITENLY's panel: the same frame as the schools' staff panels (step 7), in FAMITENLY's neutral colours.
export const metadata: Metadata = { title: { default: "FAMITENLY", template: "%s · FAMITENLY" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const THEME = readPanelTheme({
  colors: { page: "#F3F5F9", surface: "#FFFFFF", ink: "#172033", text: "#1F2937", muted: "#4B5563", line: "#E3E7EF", soft: "#E6ECF8", accent: "#2F5BEA", link: "#2449C7" },
}, "FAMITENLY");

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <body className="adm sp pf" style={panelVars(THEME)}>{children}<LookSwitcher /></body>;
}
