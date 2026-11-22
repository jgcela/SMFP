// The ONE place that decides which children a signed-in adult may see or act for.
// "My family" (the list, absences, requests) and any route that takes a child id
// must go through these functions.
//
// Two kinds of children:
//  - Children without a FACTS Student ID (typed in by the school, as before):
//    the family account the school put them in sees them (children.family_id).
//  - Children with a FACTS Student ID (children.facts_id): FACTS decides. The
//    adult sees the child only if
//      1. their account is linked to a FACTS Parent Individual ID of this school
//         through a verified invitation (facts_parents.verified_at), and
//      2. FACTS gave that parent access to that student (facts_student_access = granted).
//    "No", a Yes/No conflict, or no verified account means no access, also for
//    the family the child is listed under. FACTS Family ID never grants access.
// Everything is limited to the school of the family (and so of this address).
import type { Db } from "./facts-access";

export type VisibleChild = { id: number; name: string; grade: string; teacher: string; viaFacts: boolean };
export type Adult = { familyId: number; userId: string; schoolId: number };

/** SQL condition: may this adult see child row c? (c must be aliased "c".) */
function allowed(sql: Db, a: Adult) {
  return sql`
    c.school_id = ${a.schoolId} and not c.left_school and (
      (c.facts_id is null and c.family_id = ${a.familyId})
      or (c.facts_id is not null and exists (
        select 1 from facts_parents p
        join facts_student_access g
          on g.school_id = p.school_id and g.parent_facts_id = p.parent_facts_id
        where p.school_id = c.school_id and p.user_id = ${a.userId} and p.verified_at is not null
          and g.student_facts_id = c.facts_id and g.state = 'granted'))
    )`;
}

export async function visibleChildren(sql: Db, a: Adult): Promise<VisibleChild[]> {
  return sql<VisibleChild[]>`
    select c.id, c.name, c.grade, c.teacher, (c.facts_id is not null) as "viaFacts"
    from children c where ${allowed(sql, a)} order by c.id`;
}

/** The child, only if this adult may act for it (for actions that receive a child id). */
export async function childForAdult(sql: Db, a: Adult, childId: number): Promise<VisibleChild | null> {
  if (!Number.isInteger(childId) || childId <= 0) return null;
  const [c] = await sql<VisibleChild[]>`
    select c.id, c.name, c.grade, c.teacher, (c.facts_id is not null) as "viaFacts"
    from children c where c.id = ${childId} and ${allowed(sql, a)}`;
  return c ?? null;
}
