import type { Metadata, Viewport } from "next";
import "./portal.css";

export const metadata: Metadata = {
  title: "Parent Portal — St. Mary Catholic Virtue School",
  description:
    "Calendar, forms and school updates for St. Mary Catholic Virtue School families, school year 2026–27.",
  robots: { index: false, follow: false },
  icons: { icon: { url: "/assets/favicon.png", type: "image/png" } },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Open+Sans:wght@400;600;700&display=swap"
        />
      </head>
      {children}
    </html>
  );
}
