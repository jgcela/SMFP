// Web navigation for the same five tabs the native app has.
// Wide screens (desktop, tablet landscape): a sidebar on the left.
// Narrow screens (phone browsers): a bottom tab bar, like the native app.
// Native iOS/Android keep using _layout.tsx (NativeTabs).

import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Text } from '@/components/primitives';
import { useAnnouncements } from '@/services/queries';
import { useAppState } from '@/state/app-state';
import { spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

/** Width from which the sidebar replaces the bottom bar. */
export const WIDE_BREAKPOINT = 900;

type TabDef = { name: 'home' | 'calendar' | 'ask' | 'inbox' | 'family'; href: '/home' | '/calendar' | '/ask' | '/inbox' | '/family'; label: string; icon: IconName };

const TABS: TabDef[] = [
  { name: 'home', href: '/home', label: 'Home', icon: 'home' },
  { name: 'calendar', href: '/calendar', label: 'Calendar', icon: 'calendar' },
  { name: 'ask', href: '/ask', label: 'Ask', icon: 'ask' },
  { name: 'inbox', href: '/inbox', label: 'Inbox', icon: 'inbox' },
  { name: 'family', href: '/family', label: 'Family', icon: 'family' },
];

type ItemProps = TabTriggerSlotProps & { label: string; icon: IconName; badge?: number; wide: boolean; hidden?: boolean };

// React 19: `ref` arrives as a regular prop (TabTrigger asChild passes it).
function TabItem({ label, icon, badge, wide, hidden, isFocused, ref, ...rest }: ItemProps) {
  const { colors } = useAppTheme();
  const color = isFocused ? colors.tint : colors.textSecondary;
  if (hidden) return null;
  const badgeView: ReactNode =
    badge && badge > 0 ? (
      <View style={[s.badge, { backgroundColor: colors.danger }, wide ? null : s.badgeFloating]}>
        <Text variant="caption" style={{ color: '#FFFFFF', fontWeight: '700' }}>
          {String(badge)}
        </Text>
      </View>
    ) : null;
  return (
    <Pressable
      ref={ref as never}
      {...rest}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
      style={(state) => {
        // react-native-web adds `hovered` to the pressable state.
        const hovered = (state as { hovered?: boolean }).hovered;
        return [
        wide ? s.sideItem : s.bottomItem,
        wide && isFocused ? { backgroundColor: colors.surfaceMuted } : null,
        wide && hovered && !isFocused ? { backgroundColor: colors.grouped } : null,
        ];
      }}>
      <View>
        <Icon name={icon} size={wide ? 22 : 24} color={color} />
        {!wide && badgeView}
      </View>
      <Text variant={wide ? 'body' : 'caption'} style={{ color, fontWeight: isFocused ? '600' : wide ? '400' : '500', flex: wide ? 1 : undefined }}>
        {label}
      </Text>
      {wide && badgeView}
    </Pressable>
  );
}

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE_BREAKPOINT;
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { askAvailable, readIds, family } = useAppState();
  const announcements = useAnnouncements();
  const unread = (announcements.data ?? []).filter((a) => !readIds.has(a.id)).length;
  const school = { name: family?.school.name ?? 'St. Mary', primary: family?.school.primary || '#16335B', accent: family?.school.accent || '#FCBC40' };

  const triggers = TABS.map((t) => (
    <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
      <TabItem label={t.label} icon={t.icon} wide={wide} badge={t.name === 'inbox' ? unread : undefined} hidden={t.name === 'ask' && !askAvailable} />
    </TabTrigger>
  ));

  if (wide) {
    return (
      <Tabs style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.grouped }}>
        <TabList style={[s.sidebar, { backgroundColor: colors.surface, borderRightColor: colors.separator }]}>
          <View style={s.brandRow}>
            <View style={[s.mark, { backgroundColor: school.primary }]} accessibilityElementsHidden importantForAccessibility="no">
              <Text style={{ color: school.accent, fontWeight: '800', fontSize: 15 }}>SM</Text>
            </View>
            <Text variant="headline" style={{ flex: 1 }} numberOfLines={2}>
              {school.name}
            </Text>
          </View>
          {triggers}
        </TabList>
        <TabSlot style={{ flex: 1 }} />
      </Tabs>
    );
  }

  return (
    <Tabs style={{ flex: 1, backgroundColor: colors.grouped }}>
      <TabSlot style={{ flex: 1 }} />
      <TabList style={[s.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.separator, paddingBottom: insets.bottom }]}>
        {triggers}
      </TabList>
    </Tabs>
  );
}

const s = StyleSheet.create({
  sidebar: {
    width: 260,
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm, marginBottom: spacing.xl },
  mark: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sideItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: 10 },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 56, paddingTop: 6, paddingBottom: 4 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeFloating: { position: 'absolute', top: -6, right: -12 },
});
