import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { THEME, THEME_CSS, THEME_JS } from "../lib/theme";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The portal design (lib/theme.ts): schools' pages and the FAMITENLY panel.
  const h = await headers();
  const themed = h.has("x-portal-school") || h.get("x-portal-area") === "platform";
  return (
    <html lang="en" data-theme={themed ? THEME : undefined}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Open+Sans:wght@400;600;700&display=swap"
        />
        {themed && <link rel="stylesheet" href={THEME_CSS} precedence="theme" />}
        {themed && <script src={THEME_JS} async />}
      </head>
      {children}
    </html>
  );
}
