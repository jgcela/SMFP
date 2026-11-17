import { router, Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { EventRow, Initial, StatusRow } from '@/components/family-ui';
import { Button, Group, Row, Screen, Section, Separator, Text } from '@/components/primitives';
import { EmptyState, QueryView } from '@/components/states';
import { addDaysIso, isoDate } from '@/lib/dates';
import { absenceStatusLabel, absenceTone, absenceTypeLabel, absenceWhen, childById } from '@/lib/lookup';
import { useOpen } from '@/lib/nav';
import { useAbsences, useEvents } from '@/services/queries';
import { useAppState } from '@/state/app-state';
import { spacing } from '@/theme/tokens';

export default function ChildScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const open = useOpen();
  const { family } = useAppState();
  const child = childById(family, id);
  const events = useEvents();
  const absences = useAbsences();

  if (!child) {
    return (
      <Screen>
        <EmptyState icon="person" title="This child is not linked to your account" body="Contact the school office if this looks wrong." />
      </Screen>
    );
  }

  const today = events.data?.today ?? isoDate(new Date());
  const until = addDaysIso(today, 14);
  const upcoming = (events.data?.events ?? [])
    .filter((e) => e.childIds.length === 0 || e.childIds.includes(child.id))
    .filter((e) => (e.endDate ?? e.date) >= today && e.date <= until);
  const features = family?.features;
  const linksOn = !!features?.links;
  const mine = (absences.data ?? []).filter((a) => a.childId === child.id);

  return (
    <>
      <Stack.Screen options={{ title: child.firstName }} />
      <Screen>
        <View style={{ alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl, paddingHorizontal: spacing.lg }}>
          <Initial child={child} size={72} />
          <Text variant="title" accessibilityRole="header">
            {child.name}
          </Text>
          <Text variant="subhead" tone="secondary">
            {[child.grade, family?.school.name].filter(Boolean).join(' · ')}
          </Text>
        </View>

        {child.canReportAbsence && features?.absences && (
          <Section>
            <Button label="Report absence" icon="absence" onPress={() => router.push({ pathname: '/report-absence', params: { childId: child.id } })} />
          </Section>
        )}

        {features?.calendar ? (
        <Section title="Coming up">
          <QueryView query={events} skeletonRows={2}>
            {() =>
              upcoming.length === 0 ? (
                <Group>
                  <EmptyState icon="calendar" title={`Nothing on ${child.firstName}'s calendar in the next two weeks.`} />
                </Group>
              ) : (
                <Group>
                  {upcoming.map((e, i) => (
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
        ) : null}

        {features?.absences ? (
        <Section title="Absences you reported">
          <QueryView query={absences} skeletonRows={1}>
            {() =>
              mine.length === 0 ? (
                <Group>
                  <Text variant="subhead" tone="secondary" style={{ padding: spacing.lg }}>
                    No absences reported.
                  </Text>
                </Group>
              ) : (
                <Group>
                  {mine.map((a, i) => (
                    <View key={a.id}>
                      {i > 0 && <Separator />}
                      <StatusRow
                        title={absenceTypeLabel[a.type]}
                        subtitle={absenceWhen(a)}
                        tone={absenceTone(a.status)}
                        statusLabel={absenceStatusLabel[a.status]}
                        onPress={() => open(`absence/${a.id}`)}
                      />
                    </View>
                  ))}
                </Group>
              )
            }
          </QueryView>
        </Section>
        ) : null}

        {linksOn ? (
          <Section footer={`Grades, homework and attendance history are kept in FACTS by ${family?.school.shortName ?? 'the school'}.`}>
            <Group>
              <Row icon="link" title="Quick links" subtitle="FACTS and other school sites" onPress={() => router.push('/family/links')} />
            </Group>
          </Section>
        ) : null}
      </Screen>
    </>
  );
}
