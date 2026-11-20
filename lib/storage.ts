// Private object storage for uploaded documents. Production uses Cloudflare R2
// (S3 API, signed with aws4fetch). For local testing, STORAGE_LOCAL_DIR uses a
// folder on disk instead. Callers only ever get short-lived signed URLs.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AwsClient } from 'aws4fetch';

export type SignedUrlOptions = { fileName: string; contentType: string; expiresIn?: number; inline?: boolean };

export interface ObjectStorage {
  readonly kind: 'r2' | 'local';
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  signedGetUrl(key: string, opts: SignedUrlOptions): Promise<string>;
  /** Short-lived URL the browser PUTs a file to directly (for files too big for a server request). */
  signedPutUrl(key: string, expiresIn?: number): Promise<string>;
  /** The object's bytes, or null if missing. Throws TooLargeError above maxBytes. */
  get(key: string, maxBytes: number): Promise<Uint8Array | null>;
  /** Size in bytes and the first `n` bytes, or null if missing. */
  peek(key: string, n: number): Promise<{ size: number; head: Uint8Array } | null>;
  /** Checks that the storage answers (credentials and bucket). */
  ping(): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export class TooLargeError extends Error {
  constructor(readonly bytes: number) {
    super('The file is too large.');
    this.name = 'TooLargeError';
  }
}

export class StorageNotConfiguredError extends Error {
  constructor() {
    super('File storage is not configured yet (R2 variables in Vercel). You can add the document as a link for now.');
    this.name = 'StorageNotConfiguredError';
  }
}

/** RFC 6266 Content-Disposition with an ASCII fallback and a UTF-8 name. */
export function contentDisposition(fileName: string, inline: boolean): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

const DEFAULT_EXPIRY = 300;

export class R2Storage implements ObjectStorage {
  readonly kind = 'r2' as const;
  private client: AwsClient;
  private base: string;
  constructor(cfg: { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string }) {
    this.client = new AwsClient({
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
      service: 's3',
      region: 'auto',
    });
    this.base = `https://${cfg.accountId}.r2.cloudflarestorage.com/${cfg.bucket}`;
  }
  private url(key: string) {
    return `${this.base}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }
  async put(key: string, body: Uint8Array, contentType: string) {
    const res = await this.client.fetch(this.url(key), {
      method: 'PUT',
      body: body as unknown as BodyInit,
      headers: { 'content-type': contentType, 'content-length': String(body.byteLength) },
    });
    if (!res.ok) throw new Error(`Upload to storage failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  async signedGetUrl(key: string, opts: SignedUrlOptions) {
    const u = new URL(this.url(key));
    u.searchParams.set('X-Amz-Expires', String(opts.expiresIn ?? DEFAULT_EXPIRY));
    u.searchParams.set('response-content-disposition', contentDisposition(opts.fileName, opts.inline ?? true));
    u.searchParams.set('response-content-type', opts.contentType);
    const signed = await this.client.sign(u.toString(), { method: 'GET', aws: { signQuery: true } });
    return signed.url;
  }
  async signedPutUrl(key: string, expiresIn = 600) {
    const u = new URL(this.url(key));
    u.searchParams.set('X-Amz-Expires', String(expiresIn));
    const signed = await this.client.sign(u.toString(), { method: 'PUT', aws: { signQuery: true } });
    return signed.url;
  }
  async get(key: string, maxBytes: number) {
    const res = await this.client.fetch(this.url(key), { method: 'GET' });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Read from storage failed (${res.status})`);
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len > maxBytes) {
      await res.body?.cancel();
      throw new TooLargeError(len);
    }
    const body = new Uint8Array(await res.arrayBuffer());
    if (body.byteLength > maxBytes) throw new TooLargeError(body.byteLength);
    return body;
  }
  async peek(key: string, n: number) {
    const res = await this.client.fetch(this.url(key), { method: 'GET', headers: { range: `bytes=0-${n - 1}` } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Read from storage failed (${res.status})`);
    const total = Number((res.headers.get('content-range') ?? '').split('/')[1] ?? res.headers.get('content-length') ?? 0);
    const head = new Uint8Array(await res.arrayBuffer()).subarray(0, n);
    return { size: total || head.byteLength, head };
  }
  async ping() {
    const u = new URL(this.base);
    u.searchParams.set('list-type', '2');
    u.searchParams.set('max-keys', '1');
    try {
      const res = await this.client.fetch(u.toString(), { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }
  async delete(key: string) {
    const res = await this.client.fetch(this.url(key), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`Delete from storage failed (${res.status})`);
  }
}

/** Development only: files on disk, served by /api/dev-storage with an HMAC-signed link. */
export class LocalStorage implements ObjectStorage {
  readonly kind = 'local' as const;
  constructor(
    private root: string,
    private secret: string,
  ) {}
  private file(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(path.resolve(this.root) + path.sep)) throw new Error('Invalid storage key');
    return p;
  }
  async put(key: string, body: Uint8Array) {
    const p = this.file(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, body);
  }
  sign(key: string, exp: number, name: string, type: string, inline: boolean) {
    return createHmac('sha256', this.secret).update([key, exp, name, type, inline ? 1 : 0].join('\n')).digest('base64url');
  }
  async signedGetUrl(key: string, opts: SignedUrlOptions) {
    const exp = Math.floor(Date.now() / 1000) + (opts.expiresIn ?? DEFAULT_EXPIRY);
    const inline = opts.inline ?? true;
    const q = new URLSearchParams({
      key,
      exp: String(exp),
      name: opts.fileName,
      type: opts.contentType,
      inline: inline ? '1' : '0',
      sig: this.sign(key, exp, opts.fileName, opts.contentType, inline),
    });
    return `/api/dev-storage?${q}`;
  }
  async signedPutUrl(key: string, expiresIn = 600) {
    this.file(key);
    const exp = Math.floor(Date.now() / 1000) + expiresIn;
    const q = new URLSearchParams({ key, exp: String(exp), sig: this.sign(`put:${key}`, exp, '', '', false) });
    return `/api/dev-storage?${q}`;
  }
  verifyPut(q: URLSearchParams): string | null {
    const key = q.get('key') ?? '';
    const exp = Number(q.get('exp'));
    if (!key || !Number.isFinite(exp) || exp < Date.now() / 1000) return null;
    const want = Buffer.from(this.sign(`put:${key}`, exp, '', '', false));
    const got = Buffer.from(q.get('sig') ?? '');
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    return key;
  }
  async get(key: string, maxBytes: number) {
    try {
      const b = await readFile(this.file(key));
      if (b.byteLength > maxBytes) throw new TooLargeError(b.byteLength);
      return new Uint8Array(b);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }
  verify(q: URLSearchParams): { key: string; name: string; type: string; inline: boolean } | null {
    const key = q.get('key') ?? '';
    const exp = Number(q.get('exp'));
    const name = q.get('name') ?? '';
    const type = q.get('type') ?? '';
    const inline = q.get('inline') === '1';
    if (!key || !Number.isFinite(exp) || exp < Date.now() / 1000) return null;
    const want = Buffer.from(this.sign(key, exp, name, type, inline));
    const got = Buffer.from(q.get('sig') ?? '');
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
    return { key, name, type, inline };
  }
  read(key: string) {
    return readFile(this.file(key));
  }
  async peek(key: string, n: number) {
    try {
      const b = await readFile(this.file(key));
      return { size: b.byteLength, head: new Uint8Array(b.subarray(0, n)) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }
  async ping() {
    return true;
  }
  async delete(key: string) {
    await rm(this.file(key), { force: true });
  }
}

let cached: ObjectStorage | null | undefined;

export function getStorage(): ObjectStorage {
  if (cached === undefined) {
    const e = process.env;
    if (e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_PRIVATE_BUCKET) {
      cached = new R2Storage({
        accountId: e.R2_ACCOUNT_ID.trim(),
        accessKeyId: e.R2_ACCESS_KEY_ID.trim(),
        secretAccessKey: e.R2_SECRET_ACCESS_KEY.trim(),
        bucket: e.R2_PRIVATE_BUCKET.trim(),
      });
    } else if (e.STORAGE_LOCAL_DIR && e.BETTER_AUTH_SECRET && !e.VERCEL) {
      cached = new LocalStorage(path.resolve(e.STORAGE_LOCAL_DIR), e.BETTER_AUTH_SECRET);
    } else {
      cached = null;
    }
  }
  if (!cached) throw new StorageNotConfiguredError();
  return cached;
}

export function storageConfigured() {
  try {
    getStorage();
    return true;
  } catch {
    return false;
  }
}
