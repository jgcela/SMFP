// Quick check that the site can reach its database and file storage.
// Answers only true/false, never any detail.
import { db } from "../../../lib/db";
import { getStorage, storageConfigured } from "../../../lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const database = await db()`select 1`.then(() => true, () => false);
  const storage = storageConfigured() ? await getStorage().ping() : false;
  return Response.json({ database, storage }, { headers: { "Cache-Control": "no-store" } });
}
