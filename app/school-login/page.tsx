import { redirect } from "next/navigation";
import { MarketingBody } from "@famitenly/shell";
import { pageMeta } from "@famitenly/lib/meta";
import { SimplePage } from "@famitenly/components/SimplePage";
import { db } from "../../lib/db";
import { SLUG_RE } from "../../lib/portal";

// "School login" on FAMITENLY's website: school staff type their school's code
// and go to that school's staff panel (/s/<code>/admin).
export const dynamic = "force-dynamic";
export const metadata = pageMeta({ title: "School login", description: "Sign in to your school's staff panel.", path: "/school-login", index: false });

export default async function SchoolLogin({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = ((await searchParams).code ?? "").trim().toLowerCase().slice(0, 40);
  let notFound = false;
  if (code) {
    const [s] = SLUG_RE.test(code) ? await db()<{ slug: string }[]>`select slug from schools where slug = ${code}` : [];
    if (s) redirect(`/s/${s.slug}/admin`);
    notFound = true;
  }
  return (
    <MarketingBody>
      <SimplePage eyebrow="For school staff" title="School login">
        <p className="lede">Type your school&rsquo;s code. It is the part after /s/ in your portal&rsquo;s address.</p>
        <form action="/school-login" method="get" className="simple-actions" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontWeight: 600 }}>
            School code
            <input name="code" defaultValue={code} required autoCapitalize="none" spellCheck={false}
              aria-invalid={notFound || undefined} aria-describedby={notFound ? "code-err" : undefined}
              style={{ minHeight: 48, padding: "0 16px", border: "1px solid #c9c9c9", borderRadius: 12, font: "inherit" }} />
          </label>
          <button type="submit" className="btn btn-primary">Continue</button>
        </form>
        {notFound && <p id="code-err" role="alert">There is no school with the code &ldquo;{code}&rdquo;. Check it with your school office.</p>}
        <p>Families do not sign in here: use the link your school sent you.</p>
      </SimplePage>
    </MarketingBody>
  );
}
