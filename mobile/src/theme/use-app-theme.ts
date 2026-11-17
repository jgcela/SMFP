import { useColorScheme } from 'react-native';

import { useAppState } from '@/state/app-state';

import { brand, ensureContrast, onColor, palette, radii, type Palette } from './tokens';

export type AppTheme = {
  scheme: 'light' | 'dark';
  colors: Palette & {
    /** School primary (St. Mary navy), adjusted to read on the background. */
    tint: string;
    /** Text/icon color on a `tint` fill. */
    onTint: string;
    /** School accent, used for unread dots and school tags. */
    accent: string;
  };
  radius: number;
};

/** St. Mary navy, used before the portal sends the school's own colors. */
const FALLBACK = { primary: '#16335B', accent: '#FCBC40' };

/** Colors for the current screen: the school's colors from the portal. */
export function useAppTheme(): AppTheme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { school } = useAppState();
  const p = palette[scheme];
  const base = school?.primary || FALLBACK.primary || brand.ink;
  const tint = ensureContrast(base, p.bg);
  return {
    scheme,
    colors: { ...p, tint, onTint: onColor(tint), accent: school?.accent || FALLBACK.accent },
    radius: radii.soft,
  };
}
