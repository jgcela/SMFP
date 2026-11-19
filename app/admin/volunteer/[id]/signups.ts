import { db } from "../../../../lib/db";

export type SignupRow = { familyId: number; family: string; parents: string; phone: string; email: string; contact2: string; signedUp: string };

export function loadSignups(schoolId: number, oppId: number) {
  return db()<SignupRow[]>`
    select f.id as "familyId", f.name as family, f.parent_names as parents, f.phone, u.email,
      trim(both ' ' from f.contact2_name || case when f.contact2_phone <> '' then ' ' || f.contact2_phone else '' end) as contact2,
      v.created_at::text as "signedUp"
    from volunteer_signups v join families f on f.id = v.family_id join auth_user u on u.id = f.user_id
    where v.opportunity_id = ${oppId} and v.school_id = ${schoolId} and f.school_id = ${schoolId}
    order by v.created_at, v.id`;
}
