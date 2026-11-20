// Images placed in the school's text pages. They are kept in private storage;
// this sends the browser a short-lived link, only for this school's page images.
import { db } from "../../../lib/db";
import { schoolSlug } from "../../../lib/portal";
import { getStorage } from "../../../lib/storage";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const parts = (await ctx.params).key.map((k) => decodeURIComponent(k));
  const key = parts.join("/");
  const [s] = await db()<{ id: number }[]>`select id from schools where slug = ${await schoolSlug()}`;
  const ext = (/\.([a-z0-9]+)$/i.exec(key)?.[1] ?? "").toLowerCase();
  if (!s || parts[0] !== "pages" || parts[1] !== String(s.id) || parts.length !== 4 || !TYPES[ext] || key.includes(".."))
    return new Response("Not found", { status: 404 });
  try {
    const url = await getStorage().signedGetUrl(key, { fileName: parts[3], contentType: TYPES[ext], inline: true, expiresIn: 3600 });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, max-age=1800" } });
  } catch {
    return new Response("This image is not available right now.", { status: 503 });
  }
}
