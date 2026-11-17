import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AnnouncementRow, ChildChip, EventRow, QuickAction } from '@/components/family-ui';
import { Group, Screen, Section, Separator, Text } from '@/components/primitives';
import { EmptyState, QueryView } from '@/components/states';
import { addDaysIso, greeting, isoDate } from '@/lib/dates';
import { useOpen } from '@/lib/nav';
import { useAbsences, useAnnouncements, useEvents, useFamily } from '@/services/queries';
import { useAppState } from '@/state/app-state';
import { spacing } from '@/theme/tokens';

export default function Home() {
  const { readIds, askAvailable } = useAppState();
  const open = useOpen();
  const family = useFamily();
  const events = useEvents();
  const announcements = useAnnouncements();
  const absences = useAbsences();

  const features = family.data?.features;
  const todayIso = events.data?.today ?? isoDate(new Date());
  const { today, week } = useMemo(() => {
    const list = events.data?.events ?? [];
    const weekEnd = addDaysIso(todayIso, 7);
    return {
      today: list.filter((e) => e.date <= todayIso && (e.endDate ?? e.date) >= todayIso),
      week: list.filter((e) => e.date > todayIso && e.date <= weekEnd),
    };
  }, [events.data, todayIso]);

  const important = (announcements.data ?? []).find((a) => a.important && !readIds.has(a.id));
  const kids = family.data?.children ?? [];
  const absentToday = new Set(
    (absences.data ?? []).filter((a) => a.status !== 'cancelled' && a.status !== 'rejected' && a.dateFrom <= todayIso && (a.dateTo ?? a.dateFrom) >= todayIso).map((a) => a.childId),
  );
  const firstName = family.data?.user.name.split(' ')[0] ?? '';

  const actions = [
    features?.absences && { icon: 'absence' as const, label: 'Report absence', onPress: () => router.push('/report-absence') },
    askAvailable && { icon: 'ask' as const, label: 'Ask a question', onPress: () => router.push('/ask') },
    features?.calendar && !askAvailable && { icon: 'calendar' as const, label: 'Calendar', onPress: () => router.push('/calendar') },
    features?.documents && { icon: 'document' as const, label: 'Documents', onPress: () => router.push('/family/documents') },
    { icon: 'phone' as const, label: 'Contact school', onPress: () => router.push('/family/contact') },
    features?.requests && { icon: 'mail' as const, label: 'Ask the office', onPress: () => router.push('/new-request') },
    features?.volunteer && { icon: 'volunteer' as const, label: 'Volunteer', onPress: () => router.push('/family/volunteer') },
  ].filter((a): a is { icon: 'absence' | 'ask' | 'calendar' | 'document' | 'phone' | 'mail' | 'volunteer'; label: string; onPress: () => void } => !!a);

  const refresh = () => {
    void family.refetch();
    void events.refetch();
    void announcements.refetch();
    void absences.refetch();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: firstName ? `${greeting()}, ${firstName}` : greeting(),
        }}
      />
      <Screen refreshing={events.isRefetching} onRefresh={refresh}>
        {important && (
          <Section>
            <Group>
              <AnnouncementRow item={important} onPress={() => open(`announcement/${important.id}`)} />
            </Group>
          </Section>
        )}

        <Section title="Your children">
          <QueryView query={family} skeletonRows={1}>
            {() =>
              kids.length === 0 ? (
                <Text variant="subhead" tone="secondary">
                  {family.data?.childrenError
                    ? "We couldn't load your children's records right now. Try again later."
                    : 'No children are linked to your account yet. Contact the office to link them.'}
                </Text>
              ) : kids.length === 1 ? (
                <ChildChip wide child={kids[0]!} indicator={absentToday.has(kids[0]!.id) ? 'Absence reported today' : undefined} onPress={() => open(`child/${kids[0]!.id}`)} />
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -spacing.lg }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
                  {kids.map((c) => (
                    <ChildChip key={c.id} child={c} indicator={absentToday.has(c.id) ? 'Absence reported today' : undefined} onPress={() => open(`child/${c.id}`)} />
                  ))}
                </ScrollView>
              )
            }
          </QueryView>
        </Section>

        {features?.calendar ? (
        <>
        <Section title="Today">
          <QueryView query={events} skeletonRows={2}>
            {() =>
              today.length === 0 ? (
                <Group>
                  <Text variant="subhead" tone="secondary" style={{ padding: spacing.lg }}>
                    Nothing on the calendar today.
                  </Text>
                </Group>
              ) : (
                <Group>
                  {today.map((e, i) => (
                    <View key={e.id}>
                      {i > 0 && <Separator />}
                      <EventRow event={e} onPress={() => open(`event/${e.id}`)} />
                    </View>
                  ))}
                </Group>
              )
            }
          </QueryView>
        </Section>

        <Section title="This week" action={{ label: 'See all', onPress: () => router.push('/calendar') }}>
          <QueryView query={events} skeletonRows={3}>
            {() =>
              week.length === 0 ? (
                <Group>
                  <EmptyState icon="calendar" title="Nothing on the calendar this week." />
                </Group>
              ) : (
                <Group>
                  {week.slice(0, 5).map((e, i) => (
                    <View key={e.id}>
                      {i > 0 && <Separator />}
                      <EventRow event={e} onPress={() => open(`event/${e.id}`)} />
                    </View>
                  ))}
                </Group>
              )
            }
          </QueryView>
        </Section>
        </>
        ) : null}

        <Section title="Quick actions">
          {chunk(actions, 3).map((row, i) => (
            <View key={i} style={[s.grid, i > 0 && { marginTop: spacing.sm }]}>
              {row.map((a) => (
                <QuickAction key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} />
              ))}
              {Array.from({ length: 3 - row.length }, (_, k) => (
                <View key={`pad-${k}`} style={{ flex: 1 }} />
              ))}
            </View>
          ))}
        </Section>
      </Screen>
    </>
  );
}

function chunk<T>(list: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', gap: spacing.sm },
});
