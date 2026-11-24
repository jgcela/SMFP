import type { Metadata } from 'next';
import { brand, siteUrl } from '@famitenly/config/site';

/** What every page of the website shares: address, icons and app manifest. */
export const siteMeta: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: brand.name,
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: { url: '/apple-touch-icon.png', sizes: '180x180' },
  },
  manifest: '/manifest.webmanifest',
};

/** Title, description, canonical link and social preview for one page. */
export function pageMeta(o: { title: string; description: string; path?: string; index?: boolean }): Metadata {
  const title = `${o.title} · ${brand.name}`;
  return {
    ...siteMeta,
    title,
    description: o.description,
    alternates: { canonical: o.path ?? null },
    openGraph: {
      type: 'website',
      siteName: brand.name,
      title,
      description: o.description,
      ...(o.path ? { url: o.path } : {}),
      images: [{ url: '/og.png', width: 1200, height: 630, alt: `${brand.name} ${brand.descriptor}` }],
    },
    twitter: { card: 'summary_large_image', title, description: o.description, images: ['/og.png'] },
    ...(o.index === false ? { robots: { index: false, follow: false } } : {}),
  };
}
