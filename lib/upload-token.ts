// A signed note saying "this staff member's browser just uploaded <key>".
// The document form sends it back instead of the file itself.
import { createHmac, timingSafeEqual } from "node:crypto";

type Payload = { k: string; s: number; n: string; e: number };

function secret() {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s) throw new Error("BETTER_AUTH_SECRET is not set");
  return s;
}
const mac = (body: string) => createHmac("sha256", secret()).update(`upload:${body}`).digest("base64url");

export function signUpload(p: Payload) {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${mac(body)}`;
}

/** `area` is the storage folder the upload must be in: documents (step 4b) or staff photos (step 6c). */
export function readUpload(token: string, schoolId: number, area: "documents" | "staff" = "documents"): { key: string; name: string } | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(mac(body));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as Payload;
    if (p.s !== schoolId || p.e < Date.now() / 1000) return null;
    if (!p.k.startsWith(`${area}/${schoolId}/`)) return null;
    return { key: p.k, name: p.n };
  } catch {
    return null;
  }
}
