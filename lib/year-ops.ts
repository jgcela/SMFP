// Step 11a: creating a new school year, moving children up a grade, and
// switching the new year on. Every function works inside one transaction, so a
// failure leaves nothing half done.
import type { TransactionSql } from "postgres";
import { db } from "./db";
import { DEFAULT_MODULES } from "./plans";

type Tx = TransactionSql<Record<string, never>>;

export type NewYear = { label: string; startsOn: string; endsOn: string; copy: boolean; by: string };

/**
 * Creates a year being prepared. With copy, it takes from the active year the
 * pages, modules, links, staff cards, contact details and people, family
 * documents and the look. Calendar, notices, wishlists and volunteering are
 * never copied. Files in storage are shared, not duplicated.
 */
export async function createYear(schoolId: number, y: NewYear): Promise<number> {
  return db().begin(async (sql) => {
    const tx = sql as unknown as Tx;
    const [from] = await tx<{ id: number }[]>`select id from school_years where school_id = ${schoolId} and status = 'active' for update`;
    if (!from) throw new Error("This school has no active year.");
    let id: number;
    if (y.copy) {
      [{ id }] = await tx<{ id: number }[]>`
        insert into school_years (school_id, label, starts_on, ends_on, status, created_by, copied_from,
          logo_url, logo_key, panel_theme, modules, phone_display, phone_href, email, office_hours, address,
          notice_auto_days, staff_title, staff_lead, staff_intro_html, staff_teams)
        select school_id, ${y.label}, ${y.startsOn}, ${y.endsOn}, 'preparing', ${y.by}, id,
          logo_url, logo_key, panel_theme, modules, phone_display, phone_href, email, office_hours, address,
          notice_auto_days, staff_title, staff_lead, staff_intro_html, staff_teams
        from school_years where id = ${from.id}
        returning id`;
      await copyContent(tx, from.id, id);
    } else {
      [{ id }] = await tx<{ id: number }[]>`
        insert into school_years (school_id, label, starts_on, ends_on, status, created_by, modules)
        values (${schoolId}, ${y.label}, ${y.startsOn}, ${y.endsOn}, 'preparing', ${y.by}, ${DEFAULT_MODULES as string[]})
        returning id`;
    }
    return id;
  });
}

async function copyContent(tx: Tx, from: number, to: number) {
  await tx`
    insert into contact_people (school_id, year_id, name, role, email, sort_order)
    select school_id, ${to}, name, role, email, sort_order from contact_people where year_id = ${from}`;
  await tx`
    insert into links (school_id, year_id, placement, label, short_label, href, sort_order, new_tab, hidden)
    select school_id, ${to}, placement, label, short_label, href, sort_order, new_tab, hidden from links where year_id = ${from}`;
  // Pages: the draft and the published copy; the history stays with the old year.
  await tx`
    insert into pages (school_id, year_id, slug, legacy_path, draft_title, draft_summary, draft_html, title, summary, html, published_at, updated_at)
    select school_id, ${to}, slug, legacy_path, draft_title, draft_summary, draft_html, title, summary, html, published_at, now()
    from pages where year_id = ${from}`;
  // Staff cards (photos are shared with the old year's cards).
  await tx`
    insert into staff_favorites (school_id, year_id, team, name, role, photo_key, favorites, wishlist_href, hidden, sort_order, imported, updated_by)
    select school_id, ${to}, team, name, role, photo_key, favorites, wishlist_href, hidden, sort_order, imported, updated_by
    from staff_favorites where year_id = ${from}`;
  // Family documents: groups first, then each document in the group with the same key.
  await tx`
    insert into document_categories (school_id, year_id, key, name, description, sort_order)
    select school_id, ${to}, key, name, description, sort_order from document_categories where year_id = ${from}`;
  const docs = await tx<{ id: number; href: string; cat_key: string }[]>`
    select d.id, d.href, c.key as cat_key from documents d join document_categories c on c.id = d.category_id
    where d.year_id = ${from} order by d.id`;
  for (const d of docs) {
    const [n] = await tx<{ id: number }[]>`
      insert into documents (school_id, year_id, category_id, title, href, meta, kind, keywords, added_on, sort_order, most_used_rank,
        description, file_key, file_name, content_type, file_size)
      select d.school_id, ${to}, nc.id, d.title, d.href, d.meta, d.kind, d.keywords, d.added_on, d.sort_order, d.most_used_rank,
        d.description, d.file_key, d.file_name, d.content_type, d.file_size
      from documents d join document_categories nc on nc.year_id = ${to} and nc.key = ${d.cat_key}
      where d.id = ${d.id}
      returning id`;
    // An uploaded document opens at doc/<its id>: point the copy at its own id.
    if (n && d.href === `doc/${d.id}`) await tx`update documents set href = ${`doc/${n.id}`} where id = ${n.id}`;
  }
}

// ---- Grades ----
export const LEAVES = "__leaves__";
const norm = (g: string) => g.toLowerCase().replace(/\s+/g, " ").replace(/[.]/g, "").trim();

/** The grade after this one in the school's list; LEAVES after the last; null if not in the list. */
export function nextGrade(grades: string[], current: string): string | null {
  const i = grades.findIndex((g) => norm(g) === norm(current));
  if (i < 0) return null;
  return i === grades.length - 1 ? LEAVES : grades[i + 1];
}

export type PromotionRow = { childId: number; grade: string; leaves: boolean };

/** Saves the grades children will have in a year. In the active year they apply at once. */
export async function savePromotion(schoolId: number, yearId: number, rows: PromotionRow[]) {
  await db().begin(async (sql) => {
    const tx = sql as unknown as Tx;
    const [y] = await tx<{ status: string }[]>`select status from school_years where id = ${yearId} and school_id = ${schoolId} for update`;
    if (!y || y.status === "archived") throw new Error("Grades can only be changed for the active year or the year being prepared.");
    for (const r of rows) {
      const [c] = await tx<{ id: number }[]>`select id from children where id = ${r.childId} and school_id = ${schoolId}`;
      if (!c) continue;
      await tx`
        insert into child_years (child_id, year_id, grade, teacher, leaves) values (${r.childId}, ${yearId}, ${r.grade}, '', ${r.leaves})
        on conflict (child_id, year_id) do update set grade = excluded.grade, teacher = '', leaves = excluded.leaves`;
      if (y.status === "active") {
        await tx`update children set grade = ${r.grade}, teacher = '', left_school = ${r.leaves}, updated_at = now() where id = ${r.childId}`;
      }
    }
  });
}

/**
 * Switches a prepared year on: the active one is archived (keeping each child's
 * grade of that year), the planned grades are applied, and families see the
 * new year from now on.
 */
export async function activateYear(schoolId: number, yearId: number) {
  await db().begin(async (sql) => {
    const tx = sql as unknown as Tx;
    const [next] = await tx<{ id: number }[]>`
      select id from school_years where id = ${yearId} and school_id = ${schoolId} and status = 'preparing' for update`;
    if (!next) throw new Error("Only a year being prepared can be switched on.");
    const [cur] = await tx<{ id: number }[]>`select id from school_years where school_id = ${schoolId} and status = 'active' for update`;
    if (cur) {
      // What each child was in the year that ends.
      await tx`
        insert into child_years (child_id, year_id, grade, teacher, leaves)
        select id, ${cur.id}, grade, teacher, false from children where school_id = ${schoolId} and not left_school
        on conflict (child_id, year_id) do update set grade = excluded.grade, teacher = excluded.teacher`;
      await tx`update school_years set status = 'archived', archived_at = now() where id = ${cur.id}`;
    }
    // Planned grades (from "Move children up a grade") become the children's grades.
    await tx`
      update children c set grade = cy.grade, teacher = '', left_school = cy.leaves, updated_at = now()
      from child_years cy where cy.child_id = c.id and cy.year_id = ${yearId} and c.school_id = ${schoolId} and not c.left_school`;
    // Every child still at the school has a row for the new year.
    await tx`
      insert into child_years (child_id, year_id, grade, teacher)
      select id, ${yearId}, grade, teacher from children where school_id = ${schoolId} and not left_school
      on conflict do nothing`;
    await tx`update school_years set status = 'active', activated_at = now() where id = ${yearId}`;
  });
}
