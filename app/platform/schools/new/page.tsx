import { requirePlatformPage } from "../../../../lib/platform";
import { PLANS, price } from "../../../../lib/plans";
import { PlatformHead, PlatformSide } from "../../chrome";
import { NewSchoolForm } from "../../forms";

export const metadata = { title: "New school" };

const COMMON = ["America/New_York", "America/Chicago", "America/Denver", "America/Phoenix", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"];

export default async function NewSchool() {
  const admin = await requirePlatformPage();
  const all = Intl.supportedValuesOf("timeZone");
  const timezones = [...COMMON, ...all.filter((t) => !COMMON.includes(t))];
  return (
    <>
      <PlatformSide page="new" email={admin.email} />
      <main id="main" className="adm-main">
        <PlatformHead title="New school" back={<a href="/platform">← All schools</a>}
          lead="The school starts empty, with the basic modules: family sign-in and absences & requests. Its first administrator fills in the content." />
        <div className="adm-card">
          <NewSchoolForm plans={PLANS.map((p) => ({ id: p.id, name: p.name, price: price(p), summary: p.summary }))} timezones={timezones} />
        </div>
      </main>
    </>
  );
}
