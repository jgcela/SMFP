// App-wide state that lives on the device: the sign-in, the signed-in family
// (school, children, features), read marks and calendar filters. Everything
// else comes from the portal through TanStack Query (src/services).

import { useQueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import type { Family, School } from '@/data/types';
import { setDisplayTimeZone } from '@/lib/dates';
import { api, ApiError, auth as authApi, setSignedOutHandler } from '@/services/api';
import { setToken } from '@/services/session';

type AuthStage = 'loading' | 'signed_out' | 'two_step' | 'signed_in';
type Result = { ok: true } | { ok: false; message: string };

type AppState = {
  auth: AuthStage;
  /** Why the portal could not be reached at start-up, with a way to try again. */
  bootError: string | null;
  retryBoot: () => void;
  signIn: (email: string, password: string) => Promise<Result & { twoStep?: boolean }>;
  verifyTwoStep: (code: string) => Promise<Result>;
  signOut: () => Promise<void>;

  family: Family | null;
  school: School | null;

  readIds: ReadonlySet<string>;
  markRead: (id: string) => void;

  calendarChildIds: readonly string[];
  setCalendarChildIds: (ids: string[]) => void;

  /** The school turned on the family assistant and it is set up. */
  askAvailable: boolean;
};

const Ctx = createContext<AppState | null>(null);

// ---------- Read marks, kept on this device ----------

const READ_KEY = 'stmary.read';
async function loadRead(): Promise<string[]> {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(READ_KEY) : await SecureStore.getItemAsync(READ_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
function saveRead(ids: ReadonlySet<string>) {
  const raw = JSON.stringify([...ids].slice(-150));
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(READ_KEY, raw);
    else void SecureStore.setItemAsync(READ_KEY, raw).catch(() => undefined);
  } catch {
    // Read marks are a convenience; losing them is fine.
  }
}

function accessMessage(err: unknown): string {
  if (err instanceof ApiError && err.code === 'staff') return 'This app is for St. Mary families. Staff sign in to the school admin on the website.';
  if (err instanceof ApiError && err.code === 'not_family') return "This account isn't linked to a St. Mary family yet. Ask the school office for an invitation.";
  if (err instanceof ApiError) return err.message;
  return "We couldn't reach the school portal. Check your connection and try again.";
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [auth, setAuth] = useState<AuthStage>('loading');
  const [bootError, setBootError] = useState<string | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());
  const [calendarChildIds, setCalendarChildIds] = useState<readonly string[]>([]);

  const reset = useCallback(() => {
    setFamily(null);
    setCalendarChildIds([]);
    qc.clear();
    setAuth('signed_out');
  }, [qc]);

  /** Loads the family; a signed-out or non-family account goes back to sign-in. */
  const loadFamily = useCallback(async (): Promise<Result> => {
    try {
      const me = await api.me();
      qc.setQueryData(['me'], me);
      setFamily(me);
      setBootError(null);
      setAuth('signed_in');
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError && (err.kind === 'signed_out' || err.kind === 'forbidden')) {
        if (err.kind === 'forbidden') await authApi.signOut();
        reset();
        return err.kind === 'forbidden' ? { ok: false, message: accessMessage(err) } : { ok: false, message: 'Sign in again to continue.' };
      }
      throw err;
    }
  }, [qc, reset]);

  const boot = useCallback(() => {
    setBootError(null);
    setAuth('loading');
    loadFamily().catch((err) => {
      setBootError(accessMessage(err));
      setAuth('signed_out');
    });
  }, [loadFamily]);

  useEffect(() => {
    boot();
    void loadRead().then((ids) => setReadIds(new Set(ids)));
  }, [boot]);

  // A 401 from any screen means the session ended (expired or signed out elsewhere).
  useEffect(() => {
    setSignedOutHandler(() => {
      void setToken(null);
      reset();
    });
    return () => setSignedOutHandler(null);
  }, [reset]);

  // Keep the family (features, children) current when the query refreshes.
  useEffect(
    () =>
      qc.getQueryCache().subscribe((e) => {
        if (e.query.queryKey[0] === 'me' && e.type === 'updated' && e.query.state.data) setFamily(e.query.state.data as Family);
      }),
    [qc],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (!email.includes('@')) return { ok: false as const, message: 'Enter the email you use for the school portal.' };
      if (!password) return { ok: false as const, message: 'Enter your password.' };
      try {
        const r = await authApi.signIn(email, password);
        if (r.stage === 'two_step') {
          setAuth('two_step');
          return { ok: true as const, twoStep: true };
        }
        return await loadFamily();
      } catch (err) {
        return { ok: false as const, message: accessMessage(err) };
      }
    },
    [loadFamily],
  );

  const verifyTwoStep = useCallback(
    async (code: string): Promise<Result> => {
      const clean = code.replace(/\s/g, '');
      if (!/^\d{6}$/.test(clean) && !/^[a-z0-9-]{10,11}$/i.test(clean)) return { ok: false, message: 'Enter the 6-digit code from your authenticator app.' };
      try {
        await authApi.verifyTwoStep(clean);
        return await loadFamily();
      } catch (err) {
        return { ok: false, message: accessMessage(err) };
      }
    },
    [loadFamily],
  );

  const signOut = useCallback(async () => {
    await authApi.signOut();
    reset();
  }, [reset]);

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set([...prev, id]);
      saveRead(next);
      return next;
    });
  }, []);

  setDisplayTimeZone(family?.school.timezone);

  const value = useMemo<AppState>(
    () => ({
      auth,
      bootError,
      retryBoot: boot,
      signIn,
      verifyTwoStep,
      signOut,
      family,
      school: family?.school ?? null,
      readIds,
      markRead,
      calendarChildIds,
      setCalendarChildIds,
      askAvailable: !!family?.features.ask,
    }),
    [auth, bootError, boot, signIn, verifyTwoStep, signOut, family, readIds, markRead, calendarChildIds],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used inside AppStateProvider');
  return v;
}
