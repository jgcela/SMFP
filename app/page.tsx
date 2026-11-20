import type { Metadata } from "next";
import { loadPortal, schoolSlug } from "../lib/portal";
// Look-and-feel option "sunny" (proposal): its font and its overrides, home page only.
import "./looks/sunny.css";
import { renderPortal, schoolDescription, schoolIcon, schoolTitle } from "../lib/render";

// Built for each visit: the school comes from the address (/s/<code>/, proxy.ts).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { school } = await loadPortal(await schoolSlug());
  return { title: schoolTitle(school), description: schoolDescription(school), icons: schoolIcon(school) };
}

export default async function Home() {
  const { school, links, contacts, data } = await loadPortal(await schoolSlug());
  // "<" is escaped so no text in the data can close the script tag.
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <body>
      <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: renderPortal(school, links, contacts) }} />
      <script dangerouslySetInnerHTML={{ __html: `window.__PORTAL__=${json};` }} />
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="/portal.js" />
      {/* Links to files and other websites open in a new tab. */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="/new-tab.js" />
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="/header.js" />
    </body>
  );
}
