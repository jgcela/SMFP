import type { Metadata } from "next";
import "../admin/admin.css";

export const metadata: Metadata = { title: "Family sign-in", robots: { index: false, follow: false } };

export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return <body className="adm">{children}</body>;
}
