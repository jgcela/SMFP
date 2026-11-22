// Loads and shows the school's text pages (step 4e).
import { db } from "./db";
import { withLook } from "./look";
import { absolutePaths, withHeadingIds } from "./page-html";
import { loadPortal, schoolSlug } from "./portal";
import { renderSchoolPage } from "./render";

export type PageCopy = { title: string; summary: string; html: string };

const html = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });

export async function pageResponse(copy: PageCopy, preview?: string) {
  const { school, links, contacts } = await loadPortal(await schoolSlug());
  const { html: body, headings } = withHeadingIds(absolutePaths(copy.html));
  return html(await withLook(renderSchoolPage(school, links, contacts, { title: copy.title, summary: copy.summary, body, headings, preview })));
}

export async function findPublished(slug: string) {
  const [p] = await db()<PageCopy[]>`
    select p.title, p.summary, p.html from pages p join schools s on s.id = p.school_id
      join school_years y on y.id = p.year_id and y.status = 'active'
    where s.slug = ${await schoolSlug()} and p.slug = ${slug} and p.published_at is not null`;
  return p ?? null;
}

export const notFound = () => html(`<!doctype html><meta charset="utf-8"><title>Page not found</title><p>This page does not exist. <a href="/">Back to the Parent Portal</a></p>`, 404);
