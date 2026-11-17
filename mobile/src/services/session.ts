// Where the sign-in lives.
//
// - Web: the portal's session cookie (same site), so nothing is stored here.
// - iOS/Android: the bearer token the portal returns at sign-in, kept in the
//   device keychain (expo-secure-store).

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'stmary.session';
const native = Platform.OS !== 'web';
let cached: string | null | undefined;

export async function getToken(): Promise<string | null> {
  if (!native) return null;
  if (cached === undefined) cached = await SecureStore.getItemAsync(KEY).catch(() => null);
  return cached ?? null;
}

export async function setToken(token: string | null): Promise<void> {
  if (!native) return;
  cached = token;
  if (token) await SecureStore.setItemAsync(KEY, token);
  else await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
}

/**
 * The portal's address. On the web the app is served by the portal itself, so
 * requests go to the same site. The native app (and `expo start --web` during
 * development) set EXPO_PUBLIC_API_URL, e.g. https://portal.stmary.org.
 */
export function apiBase(): string {
  return (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
}

/** A page of the portal website (account security, the web portal), as a full URL. */
export function portalUrl(path: string): string {
  if (!native && typeof window !== 'undefined') return `${apiBase() || window.location.origin}${path}`;
  return `${apiBase()}${path}`;
}
