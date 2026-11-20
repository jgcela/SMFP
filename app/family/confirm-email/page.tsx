import type { Metadata } from "next";
import { ConfirmEmailPage } from "../../account/pages";

export const dynamic = "force-dynamic";
// The link carries a one-time token: never send it to other sites.
export const metadata: Metadata = { title: "Confirm your new email", referrer: "no-referrer" };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return <ConfirmEmailPage kind="family" token={String((await searchParams).token ?? "")} />;
}
