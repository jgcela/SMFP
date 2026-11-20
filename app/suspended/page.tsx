import type { Metadata } from "next";
import { headers } from "next/headers";
import { db } from "../../lib/db";
import "../portal.css";
import "../admin/admin.css";
import "../platform/platform.css";

// What every address of a suspended school shows (proxy.ts sends it here).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Portal not available", robots: { index: false, follow: false } };

export default async function Suspended() {
  const slug = (await headers()).get("x-portal-school") ?? "";
  const [s] = slug ? await db()<{ name: string; email: string; phone_display: string }[]>`
    select name, email, phone_display from schools where slug = ${slug}` : [];
  return (
    <body className="pf pf-solo">
      <main id="main" className="pf-card pf-card--narrow">
        <p className="pf-brand">{s?.name ?? "School portal"}</p>
        <h1>This portal is not available right now</h1>
        <p className="pf-lead">The school&rsquo;s family portal is temporarily turned off. Nobody can sign in until it is turned back on.</p>
        {s && (s.email || s.phone_display) && (
          <p>To reach the school office: {s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}{s.email && s.phone_display ? " · " : ""}{s.phone_display}</p>
        )}
      </main>
    </body>
  );
}
