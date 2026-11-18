import type { Metadata } from "next";
import { loadPortal, schoolSlug } from "../lib/portal";
import { renderPortal, schoolDescription, schoolTitle } from "../lib/render";

// The page is rebuilt from the database at most once a minute,
// so a change in the database shows up within about a minute.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const { school } = await loadPortal(schoolSlug());
  return { title: schoolTitle(school), description: schoolDescription(school) };
}

export default async function Home() {
  const { school, links, contacts, data } = await loadPortal(schoolSlug());
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
    </body>
  );
}
