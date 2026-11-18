"use server";
// Links of the signed-in user's school: "Popular", the main menu and the FACTS
// button. Every query is limited to that school; the browser never chooses it.
import { revalidatePath } from "next/cache";
import { db } from "../../../lib/db";
import { checkHref, type LinkGroup } from "../../../lib/links";
import { requireStaff } from "../../../lib/staff";

export type LinkState = { error?: string; ok?: string } | undefined;

const EDITABLE: LinkGroup[] = ["popular", "top", "facts"];
const CAN_ADD: LinkGroup[] = ["popular", "top"];

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/links");
}
const fail = (err: unknown, fallback: string) => ({ error: err instanceof Error ? err.message : fallback });

async function categoryKeys(schoolId: number) {
  const rows = await db()<{ key: string }[]>`select key from document_categories where school_id = ${schoolId}`;
  return rows.map((r) => r.key);
}

export async function saveLink(_prev: LinkState, fd: FormData): Promise<LinkState> {
  try {
    const staff = await requireStaff();
    const sql = db();
    const id = Number(fd.get("id") ?? 0) || null;
    const label = String(fd.get("label") ?? "").trim();
    const shortLabel = String(fd.get("short_label") ?? "").trim();
    const href = String(fd.get("href") ?? "").trim();
    const newTab = fd.get("new_tab") === "on";
    if (!label) return { error: "Enter the text of the link." };
    if (label.length > 60) return { error: "The text is too long (60 characters at most)." };
    if (shortLabel.length > 30) return { error: "The shorter text is too long (30 characters at most)." };
    if (href.length > 1000) return { error: "The address is too long." };
    const bad = checkHref(href, await categoryKeys(staff.schoolId));
    if (bad) return { error: bad };

    if (id) {
      const [row] = await sql<{ placement: LinkGroup }[]>`
        select placement from links where id = ${id} and school_id = ${staff.schoolId}`;
      if (!row || !EDITABLE.includes(row.placement)) return { error: "This link no longer exists." };
      const short = row.placement === "popular" ? "" : shortLabel;
      await sql`update links set label = ${label}, short_label = ${short}, href = ${href}, new_tab = ${newTab}
        where id = ${id} and school_id = ${staff.schoolId}`;
      refresh();
      return { ok: "Link saved." };
    }
    const placement = String(fd.get("placement") ?? "") as LinkGroup;
    if (!CAN_ADD.includes(placement)) return { error: "Links can only be added to “Popular” or the main menu." };
    const short = placement === "popular" ? "" : shortLabel;
    await sql`insert into links (school_id, placement, label, short_label, href, new_tab, sort_order)
      values (${staff.schoolId}, ${placement}, ${label}, ${short}, ${href}, ${newTab},
        (select coalesce(max(sort_order), -1) + 1 from links where school_id = ${staff.schoolId} and placement = ${placement}))`;
    refresh();
    return { ok: "Link added at the end of the list." };
  } catch (err) {
    return fail(err, "Could not save the link.");
  }
}

export async function deleteLink(id: number): Promise<LinkState> {
  try {
    const staff = await requireStaff();
    const r = await db()`delete from links where id = ${Number(id)} and school_id = ${staff.schoolId}
      and placement in ('popular', 'top')`;
    if (!r.count) return { error: "This link cannot be deleted, or no longer exists." };
    refresh();
    return { ok: "Link deleted." };
  } catch (err) {
    return fail(err, "Could not delete the link.");
  }
}

export async function setLinkHidden(id: number, hidden: boolean): Promise<LinkState> {
  try {
    const staff = await requireStaff();
    const r = await db()`update links set hidden = ${!!hidden} where id = ${Number(id)} and school_id = ${staff.schoolId}
      and placement in ('popular', 'top', 'facts')`;
    if (!r.count) return { error: "This link no longer exists." };
    refresh();
    return { ok: hidden ? "Link hidden. It is no longer shown on the portal." : "Link shown again on the portal." };
  } catch (err) {
    return fail(err, "Could not change the link.");
  }
}

// to: -1 up, 1 down, "first" to the top of its list.
export async function moveLink(id: number, to: -1 | 1 | "first"): Promise<LinkState> {
  try {
    const staff = await requireStaff();
    await db().begin(async (tx) => {
      const [row] = await tx<{ placement: string }[]>`
        select placement from links where id = ${Number(id)} and school_id = ${staff.schoolId} and placement in ('popular', 'top')`;
      if (!row) throw new Error("This link no longer exists.");
      const list = await tx<{ id: number }[]>`
        select id from links where school_id = ${staff.schoolId} and placement = ${row.placement} order by sort_order, id for update`;
      const ids = list.map((x) => x.id);
      const i = ids.indexOf(Number(id));
      if (to === "first") {
        ids.splice(i, 1);
        ids.unshift(Number(id));
      } else {
        const j = i + to;
        if (j < 0 || j >= ids.length) return;
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      for (let n = 0; n < ids.length; n++) await tx`update links set sort_order = ${n} where id = ${ids[n]}`;
    });
    refresh();
    return { ok: "Order saved." };
  } catch (err) {
    return fail(err, "Could not change the order.");
  }
}
