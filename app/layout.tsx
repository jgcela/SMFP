import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { currentLook, lookLinkHtml, looksEnabled } from "../lib/look";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Design proposals (preview only, lib/look.ts): schools' pages and the FAMITENLY panel.
  const h = await headers();
  const inScope = looksEnabled() && (h.has("x-portal-school") || h.get("x-portal-area") === "platform");
  const look = inScope ? await currentLook() : null;
  return (
    <html lang="en" data-look={look ?? undefined}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Open+Sans:wght@400;600;700&display=swap"
        />
        {inScope && <LookHead look={look} />}
      </head>
      {children}
    </html>
  );
}

function LookHead({ look }: { look: Awaited<ReturnType<typeof currentLook>> }) {
  // Plain <link> tags (not hoisted by React): the look's rules are scoped to html[data-look] so their order does not matter.
  const hrefs = lookLinkHtml(look).match(/href="([^"]+)"/g)!.map((s) => s.slice(6, -1));
  return <>{hrefs.map((href) => <link key={href} rel="stylesheet" href={href} precedence="look" />)}</>;
}
