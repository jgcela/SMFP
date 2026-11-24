"use server";
// Contact details of the signed-in user's school, and its contact people.
// Every query is limited to that school; the browser never chooses it.
import { revalidatePath } from "next/cache";
import { checkEmail, checkPhone, phoneHref } from "../../../lib/contact";
import { db } from "../../../lib/db";
import { requireYearStaff } from "../../../lib/staff";

export type ContactState = { error?: string; ok?: string } | undefined;

function refresh() {
  revalidatePath("/");
  revalidatePath("/admin/contact");
}
const fail = (err: unknown, fallback: string) => ({ error: err instanceof Error ? err.message : fallback });
const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").replace(/\s+/g, " ").trim();

export async function saveContact(_prev: ContactState, fd: FormData): Promise<ContactState> {
  try {
    const staff = await requireYearStaff();
    const phone = text(fd, "phone");
    const email = text(fd, "email");
    const address = text(fd, "address");
    const hours = text(fd, "office_hours");
    const bad = checkPhone(phone) ?? checkEmail(email);
    if (bad) return { error: bad };
    if (phone.length > 40 || email.length > 120) return { error: "The phone or email is too long." };
    if (address.length > 200) return { error: "The address is too long (200 characters at most)." };
    if (hours.length > 120) return { error: "The office hours are too long (120 characters at most)." };
    await db()`update school_years set phone_display = ${phone}, phone_href = ${phoneHref(phone)}, email = ${email},
      address = ${address}, office_hours = ${hours} where id = ${staff.yearId} and school_id = ${staff.schoolId}`;
    refresh();
    return { ok: "Contact details saved. They now show in both places on the portal." };
  } catch (err) {
    return fail(err, "Could not save the contact details.");
  }
}

export async function savePerson(_prev: ContactState, fd: FormData): Promise<ContactState> {
  try {
    const staff = await requireYearStaff();
    const id = Number(fd.get("id") ?? 0) || null;
    const name = text(fd, "name");
    const role = text(fd, "role");
    const email = text(fd, "email");
    if (!name) return { error: "Enter the person’s name." };
    if (name.length > 80 || role.length > 80) return { error: "The name or role is too long (80 characters at most)." };
    const bad = checkEmail(email, false);
    if (bad) return { error: bad };
    const sql = db();
    if (id) {
      const r = await sql`update contact_people set name = ${name}, role = ${role}, email = ${email}
        where id = ${id} and school_id = ${staff.schoolId} and year_id = ${staff.yearId}`;
      if (!r.count) return { error: "This person no longer exists." };
    } else {
      await sql`insert into contact_people (school_id, year_id, name, role, email, sort_order)
        values (${staff.schoolId}, ${staff.yearId}, ${name}, ${role}, ${email},
          (select coalesce(max(sort_order), -1) + 1 from contact_people where school_id = ${staff.schoolId} and year_id = ${staff.yearId}))`;
    }
    refresh();
    return { ok: id ? "Contact person saved." : "Contact person added at the end of the list." };
  } catch (err) {
    return fail(err, "Could not save the contact person.");
  }
}

export async function deletePerson(id: number): Promise<ContactState> {
  try {
    const staff = await requireYearStaff();
    const r = await db()`delete from contact_people where id = ${Number(id)} and school_id = ${staff.schoolId} and year_id = ${staff.yearId}`;
    if (!r.count) return { error: "This person no longer exists." };
    refresh();
    return { ok: "Contact person deleted." };
  } catch (err) {
    return fail(err, "Could not delete the contact person.");
  }
}

export async function movePerson(id: number, dir: -1 | 1): Promise<ContactState> {
  try {
    const staff = await requireYearStaff();
    await db().begin(async (tx) => {
      const list = await tx<{ id: number }[]>`
        select id from contact_people where school_id = ${staff.schoolId} and year_id = ${staff.yearId} order by sort_order, id for update`;
      const ids = list.map((x) => x.id);
      const i = ids.indexOf(Number(id));
      if (i < 0) throw new Error("This person no longer exists.");
      const j = i + dir;
      if (j < 0 || j >= ids.length) return;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      for (let n = 0; n < ids.length; n++) await tx`update contact_people set sort_order = ${n} where id = ${ids[n]}`;
    });
    refresh();
    return { ok: "Order saved." };
  } catch (err) {
    return fail(err, "Could not change the order.");
  }
}
