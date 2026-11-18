import { readFileSync } from "node:fs";
import path from "node:path";

// The markup of the current portal (content/portal-body.html), unchanged.
// public/portal.js is the original page script: it fills in "This week",
// the documents and the calendar, exactly as on the old page.
const markup = readFileSync(path.join(process.cwd(), "content/portal-body.html"), "utf8");

export const dynamic = "force-static";

export default function Home() {
  return (
    <body>
      <div style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: markup }} />
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="/portal.js" />
      {/* Links to other pages and files open in a new tab. */}
      {/* eslint-disable-next-line @next/next/no-sync-scripts */}
      <script src="/new-tab.js" />
    </body>
  );
}
