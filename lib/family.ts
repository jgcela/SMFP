// Families who sign in to the portal (step 5).
// Signing in only says WHO the person is (Better Auth, lib/auth.ts). Whether
// they are a family of THIS school, and whether the school approved them, is
// in the families table. The school always comes from this deployment
// (PORTAL_SCHOOL), never from the browser. Today families sign in with email and
// password; FACTS sign-in (SSO) can be added later as another way to reach the
// same families row (columns sso_provider / sso_subject), without changing the
// approval flow or anything that reads currentFamily().
import { randomInt } from "node:crypto";
import { db } from "./db";
import { schoolSlug } from "./portal";
import { currentUser } from "./staff";

export type FamilyStatus = "pending" | "approved" | "rejected" | "disabled";
export type Family = { id: number; userId: string; name: string; email: string; schoolId: number; status: FamilyStatus };

/** The family row of a sign-in for this deployment's school, whatever its status. */
export async function familyOfUser(userId: string): Promise<Family | null> {
  const [f] = await db()<Family[]>`
    select f.id, f.user_id as "userId", f.name, u.email, f.school_id as "schoolId", f.status
    from families f join schools s on s.id = f.school_id join auth_user u on u.id = f.user_id
    where f.user_id = ${userId} and s.slug = ${schoolSlug()}`;
  return f ?? null;
}

/** The signed-in family, only if this school approved it. */
export async function currentFamily(): Promise<Family | null> {
  const user = await currentUser();
  if (!user) return null;
  const f = await familyOfUser(user.id);
  return f?.status === "approved" ? f : null;
}

/** What a family sees when it cannot sign in yet (or any more). */
export const STATUS_MESSAGE: Record<Exclude<FamilyStatus, "approved">, string> = {
  pending: "Your account is waiting for the school to approve it. You can sign in once it is approved.",
  rejected: "The school did not approve this account. If you think this is a mistake, contact the school office.",
  disabled: "The school has turned off this account. Contact the school office to turn it back on.",
};

// ---- The school code ----
// 8 characters without look-alikes (no 0/O, 1/I/L), shown as ABCD-EFGH.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newFamilyCode() {
  let c = "";
  for (let i = 0; i < 8; i++) c += ALPHABET[randomInt(ALPHABET.length)];
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

/** Codes are compared without case, spaces or dashes: "abcd efgh" = "ABCD-EFGH". */
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");
