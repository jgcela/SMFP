// The logo FAMITENLY uploaded when it created the school (step 10). It is kept in
// private storage; this sends the browser a short-lived link to it.
import { db } from "../../lib/db";
import { schoolSlug } from "../../lib/portal";
import { getStorage } from "../../lib/storage";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

export async function GET() {
  const [s] = await db()<{ logo_key: string }[]>`select logo_key from schools where slug = ${await schoolSlug()}`;
  const key = s?.logo_key ?? "";
  const ext = (/\.([a-z0-9]+)$/i.exec(key)?.[1] ?? "").toLowerCase();
  if (!key || !TYPES[ext]) return new Response("Not found", { status: 404 });
  try {
    const url = await getStorage().signedGetUrl(key, { fileName: `logo.${ext}`, contentType: TYPES[ext], inline: true, expiresIn: 3600 });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "public, max-age=1800" } });
  } catch {
    return new Response("This image is not available right now.", { status: 503 });
  }
}
