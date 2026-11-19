import { redirect } from "next/navigation";
import { db } from "../../../lib/db";
import { currentStaff } from "../../../lib/staff";
import { AdminTop } from "../chrome";
import { ContactManager, type ContactDetails, type Person } from "./manager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contact" };

export default async function ContactPage() {
  const { staff } = await currentStaff();
  if (!staff) redirect("/admin");
  const [[school], people] = await Promise.all([
    db()<ContactDetails[]>`
      select phone_display as phone, email, address, office_hours as "officeHours" from schools where id = ${staff.schoolId}`,
    db()<Person[]>`select id, name, role, email from contact_people where school_id = ${staff.schoolId} order by sort_order, id`,
  ]);
  return (
    <>
      <AdminTop signedIn section="contact" />
      <main id="main" className="adm-main">
        <ContactManager details={{ ...school }} people={[...people]} />
      </main>
    </>
  );
}
