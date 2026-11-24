// Upload checks. The file's real type comes from its first bytes, never from
// the browser's claim. Only PDF, Word and images are accepted.
// `short` is what the portal shows next to the document ("PDF · 1.8 MB").
export type FileKind = { ext: string; contentType: string; label: string; short: string };

const KINDS = {
  pdf: { ext: 'pdf', contentType: 'application/pdf', label: 'PDF', short: 'PDF' },
  png: { ext: 'png', contentType: 'image/png', label: 'PNG image', short: 'Image' },
  jpg: { ext: 'jpg', contentType: 'image/jpeg', label: 'JPEG image', short: 'Image' },
  gif: { ext: 'gif', contentType: 'image/gif', label: 'GIF image', short: 'Image' },
  webp: { ext: 'webp', contentType: 'image/webp', label: 'WebP image', short: 'Image' },
  docx: { ext: 'docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word document', short: 'Word' },
  doc: { ext: 'doc', contentType: 'application/msword', label: 'Word document (old format)', short: 'Word' },
} satisfies Record<string, FileKind>;

export const ALLOWED_DESCRIPTION = 'a PDF, a Word document or an image (PNG, JPEG, GIF, WebP)';
export const ACCEPT_ATTR = '.pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp';

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

function extOf(name: string) {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name);
  return m ? m[1]!.toLowerCase() : '';
}

/**
 * Returns the detected kind, or an error message. The extension must agree
 * with the content, so a renamed executable or HTML page is refused.
 */
export function detectFileKind(name: string, b: Uint8Array): { ok: true; kind: FileKind } | { ok: false; error: string } {
  const ext = extOf(name);
  const refuse = { ok: false as const, error: `This file type is not allowed. Upload ${ALLOWED_DESCRIPTION}.` };
  if (b.length === 0) return { ok: false, error: 'The file is empty.' };
  if (startsWith(b, ascii('%PDF-'))) return ext === 'pdf' ? { ok: true, kind: KINDS.pdf } : mismatch(ext, 'PDF');
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return ext === 'png' ? { ok: true, kind: KINDS.png } : mismatch(ext, 'PNG');
  if (startsWith(b, [0xff, 0xd8, 0xff])) return ext === 'jpg' || ext === 'jpeg' ? { ok: true, kind: KINDS.jpg } : mismatch(ext, 'JPEG');
  if (startsWith(b, ascii('GIF87a')) || startsWith(b, ascii('GIF89a'))) return ext === 'gif' ? { ok: true, kind: KINDS.gif } : mismatch(ext, 'GIF');
  if (startsWith(b, ascii('RIFF')) && startsWith(b, ascii('WEBP'), 8)) return ext === 'webp' ? { ok: true, kind: KINDS.webp } : mismatch(ext, 'WebP');
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) {
    // Office Open XML files are ZIPs; the extension picks which one.
    if (ext === 'docx') return { ok: true, kind: KINDS.docx };
    return refuse;
  }
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
    if (ext === 'doc') return { ok: true, kind: KINDS.doc };
    return refuse;
  }
  return refuse;
}

function mismatch(ext: string, actual: string) {
  return { ok: false as const, error: `The file name ends in .${ext || '(none)'} but the file is a ${actual}. Rename it and try again.` };
}

/** A safe display/download name: no paths, no control characters, sensible length, correct extension. */
export function sanitizeFileName(name: string, kind: FileKind): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  let stem = base
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '');
  if (!stem) stem = 'document';
  if (stem.length > 120) stem = stem.slice(0, 120).trim();
  const ext = kind.ext === 'jpg' && /\.jpeg$/i.test(base) ? 'jpeg' : kind.ext;
  return `${stem}.${ext}`;
}

/** ASCII key segment for object storage. */
export function storageSafeName(fileName: string): string {
  return (
    fileName
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+/, '')
      .slice(0, 100) || 'file'
  );
}

/** "PDF · 1.8 MB" */
export function fileMeta(kind: FileKind, bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${kind.short} · ${mb < 0.1 ? '0.1' : mb.toFixed(1)} MB`;
}

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
