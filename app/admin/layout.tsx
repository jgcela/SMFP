import type { Metadata } from "next";
import "./admin.css";

export const metadata: Metadata = { title: "Staff sign-in", robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <body className="adm">{children}</body>;
}
