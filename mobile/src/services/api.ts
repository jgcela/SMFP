// The app's only door to data: the portal's app API (/api/app/v1) and its
// sign-in endpoints (/api/auth). Screens never call fetch directly.

import { Platform } from 'react-native';

import type {
  AbsenceNotice,
  AbsenceReason,
  AbsenceType,
  Announcement,
  CommunityItem,
  CommunityKind,
  Conversation,
  ConversationSummary,
  Family,
  OfficeRequest,
  OfficeRequestSummary,
  QuickLink,
  SchoolDocument,
  SchoolEvent,
  VolunteerOpportunity,
} from '@/data/types';

import { apiBase, getToken, setToken } from './session';

export type ApiErrorKind = 'offline' | 'network' | 'signed_out' | 'forbidden' | 'not_found' | 'invalid' | 'unavailable';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly code?: string,
  ) {
    super(message);
  }
}

let onSignedOut: (() => void) | null = null;
/** Called once by the app state: a 401 from the API means the session ended. */
export function setSignedOutHandler(fn: (() => void) | null) {
  onSignedOut = fn;
}

type Opts = { method?: string; body?: unknown; auth?: boolean };

async function request<T>(path: string, opts: Opts = {}): Promise<{ data: T; res: Response }> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = await getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'include',
    });
  } catch {
    const offline = Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false;
    throw new ApiError(offline ? "You're offline." : "We couldn't reach the school portal.", offline ? 'offline' : 'network');
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const body = (data ?? {}) as { error?: string; message?: string; code?: string };
    const message = body.error ?? body.message ?? "Something went wrong. Please try again.";
    const kind: ApiErrorKind =
      res.status === 401 ? 'signed_out' : res.status === 403 ? 'forbidden' : res.status === 404 ? 'not_found' : res.status === 400 || res.status === 422 || res.status === 429 ? 'invalid' : res.status === 503 ? 'unavailable' : 'network';
    if (kind === 'signed_out' && opts.auth !== false) onSignedOut?.();
    throw new ApiError(message, kind, body.code);
  }
  return { data: data as T, res };
}

const get = async <T>(path: string) => (await request<T>(`/api/app/v1${path}`)).data;
const post = async <T>(path: string, body: unknown = {}) => (await request<T>(`/api/app/v1${path}`, { method: 'POST', body })).data;

function newKey(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---------- Sign-in ----------

export type SignInResult = { stage: 'signed_in' } | { stage: 'two_step' };

async function keepToken(res: Response) {
  const token = res.headers.get('set-auth-token');
  if (token) await setToken(token);
}

export const auth = {
  async signIn(email: string, password: string): Promise<SignInResult> {
    try {
      const { data, res } = await request<{ twoFactorRedirect?: boolean }>('/api/auth/sign-in/email', {
        method: 'POST',
        body: { email: email.trim(), password, rememberMe: true },
        auth: false,
      });
      if (data?.twoFactorRedirect) return { stage: 'two_step' };
      await keepToken(res);
      return { stage: 'signed_in' };
    } catch (err) {
      if (err instanceof ApiError && (err.kind === 'signed_out' || err.code === 'INVALID_EMAIL_OR_PASSWORD')) {
        throw new ApiError("That email and password don't match. Try again.", 'invalid', err.code);
      }
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        throw new ApiError('Confirm your email first. Check your inbox for the link from the school.', 'invalid', err.code);
      }
      throw err;
    }
  },

  /** The 6-digit code from an authenticator app, or a 10-character backup code. */
  async verifyTwoStep(code: string): Promise<void> {
    const clean = code.replace(/\s/g, '');
    const path = /^\d{6}$/.test(clean) ? '/api/auth/two-factor/verify-totp' : '/api/auth/two-factor/verify-backup-code';
    try {
      const { res } = await request(path, { method: 'POST', body: { code: clean, trustDevice: true }, auth: false });
      await keepToken(res);
    } catch (err) {
      if (err instanceof ApiError && (err.kind === 'signed_out' || err.kind === 'invalid')) {
        throw new ApiError("That code didn't work. Check the app and try again.", 'invalid', err.code);
      }
      throw err;
    }
  },

  async signOut(): Promise<void> {
    try {
      await request('/api/auth/sign-out', { method: 'POST', body: {}, auth: false });
    } catch {
      // Signing out on this device still works when the portal can't be reached.
    }
    await setToken(null);
  },
};

// ---------- Family data ----------

export type AbsenceInput = {
  childId: string;
  type: AbsenceType;
  dateFrom: string;
  dateTo?: string;
  time?: string;
  reason: AbsenceReason;
  comment?: string;
};

export type RequestInput = { kind: 'question' | 'request'; subject: string; body: string; childId?: string };

export const api = {
  me: () => get<Family>('/me'),

  events: (range?: { from: string; to: string }) =>
    get<{ today: string; events: SchoolEvent[] }>(range ? `/events?from=${range.from}&to=${range.to}` : '/events'),
  event: (id: string) => get<SchoolEvent>(`/events/${encodeURIComponent(id)}`),

  announcements: () => get<Announcement[]>('/announcements'),
  announcement: (id: string) => get<Announcement>(`/announcements/${encodeURIComponent(id)}`),

  documents: () => get<SchoolDocument[]>('/documents'),
  /** A short-lived link to open the file. */
  documentUrl: (slug: string) => get<{ url: string; fileName: string }>(`/documents/${encodeURIComponent(slug)}`),

  requests: () => get<OfficeRequestSummary[]>('/requests'),
  request: (id: string) => get<OfficeRequest>(`/requests/${encodeURIComponent(id)}`),
  createRequest: (input: RequestInput) => post<{ id: string; number: number }>('/requests', input),
  replyToRequest: (id: string, body: string) => post<unknown>(`/requests/${encodeURIComponent(id)}/reply`, { body }),
  cancelRequest: (id: string) => post<unknown>(`/requests/${encodeURIComponent(id)}/cancel`),

  absences: () => get<AbsenceNotice[]>('/absences'),
  /** One key per form, so a double tap or a retry sends one notice. */
  submitAbsence: (input: AbsenceInput & { idempotencyKey?: string }) =>
    post<{ id: string; requestId: string | null; status: string }>('/absences', { ...input, idempotencyKey: input.idempotencyKey ?? newKey() }),
  cancelAbsence: (id: string) => post<unknown>(`/absences/${encodeURIComponent(id)}/cancel`),

  volunteer: () => get<VolunteerOpportunity[]>('/volunteer'),
  community: (kind: CommunityKind) => get<CommunityItem[]>(`/community?kind=${kind}`),
  links: () => get<QuickLink[]>('/links'),

  conversations: () => get<ConversationSummary[]>('/assistant/conversations'),
  conversation: (id: string) => get<Conversation>(`/assistant/conversations/${encodeURIComponent(id)}`),
  deleteConversation: (id: string) => request(`/api/app/v1/assistant/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' }).then(() => true),
  ask: (conversationId: string | null, text: string) => post<{ conversationId: string; messageId: string }>('/assistant/messages', { conversationId, text }),
  /** Sends or discards a draft the assistant prepared. Nothing is sent without this step. */
  decideAction: (actionId: string, decision: 'confirm' | 'dismiss') => post<{ ref?: string; ok?: boolean }>(`/assistant/actions/${encodeURIComponent(actionId)}`, { decision }),
};

export { newKey as newIdempotencyKey };
