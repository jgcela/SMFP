// A staff member's photo (step 6c). Kept in private storage; only someone who may see
// the Staff favorites page gets a short-lived link to it.
import { db } from "../../../../lib/db";
import { schoolSlug, moduleOn } from "../../../../lib/portal";
import { staffViewer } from "../../../../lib/staff-favorites-db";
import { currentStaff } from "../../../../lib/staff";
import { getStorage } from "../../../../lib/storage";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await moduleOn("staff_favorites"))) return new Response("Not found", { status: 404 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
  if ((await staffViewer()) !== "allowed") return new Response("Sign in to see this photo.", { status: 403 });
  // Families see the active year's photos; the school's staff, any year's (step 11a).
  const isStaff = !!(await currentStaff()).staff;
  const [row] = await db()<{ key: string | null }[]>`
    select f.photo_key as key from staff_favorites f join schools s on s.id = f.school_id
      join school_years y on y.id = f.year_id
    where f.id = ${id} and s.slug = ${await schoolSlug()} and (y.status = 'active' or ${isStaff})`;
  const ext = (/\.([a-z0-9]+)$/i.exec(row?.key ?? "")?.[1] ?? "").toLowerCase();
  if (!row?.key || !TYPES[ext]) return new Response("Not found", { status: 404 });
  try {
    const url = await getStorage().signedGetUrl(row.key, { fileName: `photo.${ext}`, contentType: TYPES[ext], inline: true, expiresIn: 3600 });
    return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": "private, max-age=1800" } });
  } catch {
    return new Response("This photo is not available right now.", { status: 503 });
  }
}
