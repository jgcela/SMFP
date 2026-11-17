import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Group, Screen, Section, Text } from '@/components/primitives';
import { EmptyState, QueryView } from '@/components/states';
import type { CommunityItem, CommunityKind } from '@/data/types';
import { useCommunity } from '@/services/queries';
import { spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const TABS: { kind: CommunityKind; label: string; empty: string }[] = [
  { kind: 'wishlist', label: 'Wish lists', empty: 'No teacher wish lists yet.' },
  { kind: 'favorites', label: 'Favorite things', empty: 'No favorite things shared yet.' },
];

export default function Community() {
  const { colors } = useAppTheme();
  const [kind, setKind] = useState<CommunityKind>('wishlist');
  const q = useCommunity(kind);
  const tab = TABS.find((t) => t.kind === kind)!;

  const groups = useMemo(() => {
    const m = new Map<string, CommunityItem[]>();
    for (const it of q.data ?? []) m.set(it.group ?? '', [...(m.get(it.group ?? '') ?? []), it]);
    return [...m.entries()];
  }, [q.data]);

  return (
    <>
      <Stack.Screen options={{ title: 'Community' }} />
      <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        <View style={[s.segment, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="tablist">
          {TABS.map((t) => (
            <Pressable
              key={t.kind}
              onPress={() => setKind(t.kind)}
              accessibilityRole="tab"
              accessibilityState={{ selected: kind === t.kind }}
              style={[s.segmentItem, kind === t.kind && { backgroundColor: colors.surface }]}>
              <Text variant="subhead" style={{ fontWeight: '600' }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <QueryView query={q} skeletonRows={3}>
          {(items) =>
            items.length === 0 ? (
              <EmptyState icon="heart" title={tab.empty} />
            ) : (
              groups.map(([group, list]) => (
                <Section key={group || 'all'} title={group || undefined}>
                  {list.map((it) => (
                    <Group key={it.id} style={{ padding: spacing.lg, gap: spacing.xs, marginBottom: spacing.sm }}>
                      <Text variant="headline">{it.name}</Text>
                      {it.role ? (
                        <Text variant="subhead" tone="secondary">
                          {it.role}
                        </Text>
                      ) : null}
                      {it.details.map((d) => (
                        <Text key={d.label} variant="body">
                          <Text variant="body" style={{ fontWeight: '600' }}>
                            {d.label}:
                          </Text>{' '}
                          {d.value}
                        </Text>
                      ))}
                      {it.url ? (
                        <Text variant="subhead" tone="tint" accessibilityRole="link" onPress={() => void Linking.openURL(it.url!)}>
                          {kind === 'wishlist' ? 'Open the wish list' : 'More'}
                        </Text>
                      ) : null}
                    </Group>
                  ))}
                </Section>
              ))
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}

const s = StyleSheet.create({
  segment: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: 10, padding: 2 },
  segmentItem: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
});
