// A family signs up for (or out of) a volunteer opportunity from the Volunteer page.
// A plain form post, so it works without JavaScript; it always goes back to the page.
import { db } from "../../../lib/db";
import { currentFamily } from "../../../lib/family";
import { todayIn } from "../../../lib/my-family";
import { changeSignup } from "../../../lib/volunteer-db";

export const dynamic = "force-dynamic";

const back = (req: Request, m: string, id?: number) =>
  new Response(null, { status: 303, headers: { Location: new URL(`/volunteer?m=${m}${id ? `#opp-${id}` : ""}`, req.url).toString() } });

export async function POST(req: Request) {
  const fd = await req.formData().catch(() => null);
  const id = Number(fd?.get("id") ?? 0);
  const join = fd?.get("do") !== "leave";
  // Only a form from this site may sign a family up.
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return new Response("Forbidden", { status: 403 });
  const family = await currentFamily();
  if (!family) return back(req, "signin", id || undefined);
  if (!Number.isInteger(id) || id <= 0) return back(req, "gone");
  const [s] = await db()<{ timezone: string }[]>`select timezone from schools where id = ${family.schoolId}`;
  const r = await changeSignup(family.schoolId, family.id, id, join, todayIn(s?.timezone || "UTC"));
  return back(req, r, id);
}
