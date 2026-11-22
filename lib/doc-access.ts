// Family documents are only for the school's approved families and its staff.
// The PDFs of the documents list are files bundled with the code (assets/...),
// so they are guarded in proxy.ts, before the file is sent. Uploaded documents
// (/doc/<id>) and the list on the home page check the same rule.
import { auth } from "./auth";
import { db } from "./db";

// Every file under this folder is a family document.
const DOC_FOLDER = "assets/documents/";

// Files the schools list as documents (any year), asked once every 20 seconds.
type Files = { at: number; bySchool: Map<string, Set<string>> };
const g = globalThis as unknown as { __docFiles?: Files; __docFilesLoading?: Promise<Files> };

async function documentFiles(slug: string): Promise<Set<string>> {
  const now = Date.now();
  if (!g.__docFiles || now - g.__docFiles.at > 20_000) {
    g.__docFilesLoading ??= db()<{ slug: string; href: string }[]>`
      select s.slug, d.href from documents d join schools s on s.id = d.school_id
      where d.kind = 'file' and d.href <> '' and d.href !~ '^(https?:)?//'`
      .then((rows) => {
        const bySchool = new Map<string, Set<string>>();
        for (const r of rows) {
          const set = bySchool.get(r.slug) ?? new Set<string>();
          set.add(r.href.replace(/^\/+/, ""));
          bySchool.set(r.slug, set);
        }
        return { at: Date.now(), bySchool };
      })
      .finally(() => { g.__docFilesLoading = undefined; });
    try {
      g.__docFiles = await g.__docFilesLoading;
    } catch {
      if (!g.__docFiles) return new Set();
    }
  }
  return g.__docFiles.bySchool.get(slug) ?? new Set();
}

/** Whether a bundled file (path without the school part, e.g. "/assets/documents/x.pdf") is a family document. */
export async function isDocumentFile(path: string, slug: string): Promise<boolean> {
  let p = path.replace(/^\/+/, "");
  try {
    p = decodeURIComponent(p);
  } catch {}
  if (p.startsWith(DOC_FOLDER)) return true;
  return (await documentFiles(slug)).has(p);
}

/** Whether the request comes from an approved family of this school or its staff. */
export async function mayOpenDocuments(headers: Headers, slug: string): Promise<boolean> {
  const s = await auth().api.getSession({ headers }).catch(() => null);
  if (!s?.user) return false;
  const [r] = await db()<{ ok: boolean }[]>`
    select exists (
      select 1 from school_staff ss join schools sc on sc.id = ss.school_id
      where ss.user_id = ${s.user.id} and sc.slug = ${slug} and sc.status <> 'suspended'
    ) or exists (
      select 1 from families f join schools sc on sc.id = f.school_id
      where f.user_id = ${s.user.id} and sc.slug = ${slug} and f.status = 'approved' and sc.status <> 'suspended'
    ) as ok`;
  return !!r?.ok;
}
