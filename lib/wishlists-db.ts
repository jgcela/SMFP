// Step 6d: loading Teacher wishlists (server only).
import { db } from "./db";
import type { Group, Wishlist } from "./wishlists";

export async function loadWishlists(schoolId: number, opts: { includeHidden?: boolean } = {}) {
  const sql = db();
  return sql<Wishlist[]>`
    select w.id, w.staff_id as "staffId", coalesce(f.name, w.name) as name, w.name as "ownName", w.class_text as "classText",
      w.grp, w.store_url as "storeUrl", w.hidden, w.imported,
      coalesce((select json_agg(json_build_object('id', i.id, 'name', i.name, 'url', i.url, 'quantity', i.quantity, 'done', i.done)
        order by i.done, i.sort_order, i.id) from wishlist_items i where i.wishlist_id = w.id), '[]') as items
    from wishlists w left join staff_favorites f on f.id = w.staff_id and f.school_id = w.school_id
    where w.school_id = ${schoolId} ${opts.includeHidden ? sql`` : sql`and not w.hidden`}
    order by w.sort_order, w.id`;
}

export async function loadWishlistPage(schoolId: number) {
  const [s] = await db()<{ title: string; lead: string; intro: string; groups: Group[] }[]>`
    select wishlist_title as title, wishlist_lead as lead, wishlist_intro_html as intro, wishlist_groups as groups from schools where id = ${schoolId}`;
  return s ?? { title: "", lead: "", intro: "", groups: [] };
}
