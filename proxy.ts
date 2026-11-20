// Every school lives under its own address: /s/<code>/ (St. Mary: /s/stmary/).
// This runs before every request and:
//  - turns /s/<code>/rest into the page /rest, telling the app which school it is
//    for in the x-portal-school header (any copy sent by the browser is removed,
//    so only the address decides the school);
//  - sends old addresses without /s/<code> (bookmarks, links in emails sent
//    before step 10) to the right school: the one of the page the person came
//    from, else the last school they visited, else the school whose files are
//    bundled with the code (PORTAL_SCHOOL);
//  - shows FAMITENLY's own home page at "/";
//  - keeps the bundled files of that school (PDFs, flyers, logos...) out of
//    every other school's address.
// The FAMITENLY panel (/platform) never belongs to a school.
import { NextResponse, type NextRequest } from "next/server";
import { db } from "./lib/db";
import publicFiles from "./lib/public-files.json";

const HEADER = "x-portal-school";
const COOKIE = "portal_school";
const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const BUNDLED_SCHOOL = process.env.PORTAL_SCHOOL ?? "";
const PUBLIC = new Set<string>(publicFiles as string[]);
// Bundled files every school uses (scripts, styles, fonts). Everything else in
// public/ belongs to the bundled school only.
const SHARED = /^(header|new-tab|page|portal|volunteer|staff-favorites|wishlists)\.js$|^page\.css$|^assets\/(css|fonts)\//;

const isFile = (path: string) => {
  const p = path.replace(/^\//, "");
  if (PUBLIC.has(p)) return true;
  try {
    return PUBLIC.has(decodeURIComponent(p));
  } catch {
    return false;
  }
};
const bundledOnly = (path: string) => {
  let p = path.replace(/^\//, "");
  try {
    p = decodeURIComponent(p);
  } catch {}
  return !SHARED.test(p);
};

// Which schools exist and which are suspended, asked once every 20 seconds.
type State = { at: number; status: Map<string, string> };
const g = globalThis as unknown as { __schoolState?: State; __schoolStateLoading?: Promise<State> };
async function schoolStatus(slug: string): Promise<string | null | undefined> {
  const now = Date.now();
  if (!g.__schoolState || now - g.__schoolState.at > 20_000) {
    g.__schoolStateLoading ??= db()<{ slug: string; status: string }[]>`select slug, status from schools`
      .then((rows) => ({ at: Date.now(), status: new Map(rows.map((r) => [r.slug, r.status])) }))
      .finally(() => { g.__schoolStateLoading = undefined; });
    try {
      g.__schoolState = await g.__schoolStateLoading;
    } catch {
      if (!g.__schoolState) return undefined; // database unreachable: let the page answer
    }
  }
  return g.__schoolState.status.get(slug) ?? null;
}

const notFound = () => new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });

function schoolFromReferer(req: NextRequest) {
  const ref = req.headers.get("referer");
  if (!ref) return null;
  try {
    const u = new URL(ref);
    if (u.host !== req.nextUrl.host) return null;
    const m = /^\/s\/([^/]+)/.exec(u.pathname);
    return m && SLUG.test(m[1]) ? m[1] : null;
  } catch {
    return null;
  }
}

export async function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;
  const headers = new Headers(req.headers);
  headers.delete(HEADER);
  const pass = () => NextResponse.next({ request: { headers } });

  if (path.startsWith("/platform") || path.startsWith("/_next/") || path === "/api/health" || path === "/welcome") return pass();
  if (path === "/suspended") return notFound();

  const m = /^\/s\/([^/]+)(\/.*)?$/.exec(path);
  if (m) {
    const slug = m[1];
    const rest = m[2] ?? "";
    if (!SLUG.test(slug)) return notFound();
    const status = await schoolStatus(slug);
    if (status === null) return notFound();
    // The home page ends in "/", so the relative links of the page (and of the
    // school's data) stay inside the school's address.
    if (rest === "") return NextResponse.redirect(new URL(`/s/${slug}/${url.search}`, req.url), 308);
    if (rest.length > 1 && rest.endsWith("/")) return NextResponse.redirect(new URL(`/s/${slug}${rest.replace(/\/+$/, "")}${url.search}`, req.url), 308);
    if (isFile(rest)) {
      if (bundledOnly(rest) && slug !== BUNDLED_SCHOOL) return notFound();
      return NextResponse.rewrite(new URL(`${rest}${url.search}`, req.url), { request: { headers } });
    }
    if (rest.startsWith("/platform") || rest === "/welcome" || rest === "/suspended") return notFound();
    headers.set(HEADER, slug);
    // A suspended school: every page of it (portal, staff and family areas, forms)
    // shows the notice instead; nobody of the school can sign in.
    const target = status === "suspended" ? "/suspended" : `${rest}${url.search}`;
    const res = NextResponse.rewrite(new URL(target, req.url), { request: { headers } });
    if (req.cookies.get(COOKIE)?.value !== slug)
      res.cookies.set(COOKIE, slug, { path: "/", sameSite: "lax", httpOnly: true, secure: url.protocol === "https:", maxAge: 60 * 60 * 24 * 365 });
    return res;
  }

  // Files at their plain address (/assets/..., /header.js) are served as always.
  if (isFile(path)) return pass();
  if (path.length > 1 && path.endsWith("/")) return NextResponse.redirect(new URL(`${path.replace(/\/+$/, "")}${url.search}`, req.url), 308);

  const fromPage = schoolFromReferer(req);
  if (path === "/") {
    // A link to "/" from a school's page goes to that school's home page;
    // otherwise this is FAMITENLY's home page.
    if (fromPage) return NextResponse.redirect(new URL(`/s/${fromPage}/${url.search}`, req.url), 307);
    return NextResponse.rewrite(new URL("/welcome", req.url), { request: { headers } });
  }

  const cookie = req.cookies.get(COOKIE)?.value;
  const slug = fromPage ?? (cookie && SLUG.test(cookie) ? cookie : null) ?? (SLUG.test(BUNDLED_SCHOOL) ? BUNDLED_SCHOOL : null);
  if (!slug) return notFound();
  if (req.method === "GET" || req.method === "HEAD") {
    return NextResponse.redirect(new URL(`/s/${slug}${path}${url.search}`, req.url), 307);
  }
  // A form sent to an old address: answer it for that school without moving.
  headers.set(HEADER, slug);
  return NextResponse.rewrite(new URL(`${path}${url.search}`, req.url), { request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
