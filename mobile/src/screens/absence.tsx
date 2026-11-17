import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { StatusLabel } from '@/components/family-ui';
import { Button, Group, haptic, Row, Screen, Section, Separator, Text, TextButton } from '@/components/primitives';
import { EmptyState, LoadingSkeleton } from '@/components/states';
import type { AbsenceStatus } from '@/data/types';
import { relative } from '@/lib/dates';
import { absenceCancellable, absenceReasonLabel, absenceStatusLabel, absenceTone, absenceTypeLabel, absenceWhen } from '@/lib/lookup';
import { useOpen } from '@/lib/nav';
import { useAbsence, useCancelAbsence } from '@/services/queries';
import { spacing } from '@/theme/tokens';

const steps = [
  { label: 'Received', text: 'The office received your report.' },
  { label: 'In review', text: 'The office is reviewing it.' },
  { label: 'Recorded', text: 'The office recorded it.' },
];

/** How far along the notice is: 0 received, 1 in review, 2 recorded. */
function progress(s: AbsenceStatus): number {
  if (s === 'pending_review') return 1;
  if (s === 'approved' || s === 'sis_sync_pending' || s === 'sis_synced' || s === 'sync_failed') return 2;
  return 0;
}

export default function AbsenceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useAbsence(id);
  const cancel = useCancelAbsence();
  const [confirming, setConfirming] = useState(false);
  const open = useOpen();
  const a = q.data;

  return (
    <>
      <Stack.Screen options={{ title: 'Absence report' }} />
      <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        {!a ? (
          q.notFound ? (
            <EmptyState icon="error" title="This report is no longer available" />
          ) : q.isError ? (
            <EmptyState icon="error" title="We couldn't load this" action={{ label: 'Try again', onPress: () => void q.refetch() }} />
          ) : (
            <LoadingSkeleton />
          )
        ) : (
          (() => {
            const reached = progress(a.status);
            const canCancel = absenceCancellable(a.status);
            const stopped = a.status === 'cancelled' || a.status === 'rejected';
            return (
              <>
                <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.xs }}>
                  <Text variant="title" accessibilityRole="header">
                    {a.childName.split(' ')[0]}: {absenceTypeLabel[a.type]}
                  </Text>
                  <StatusLabel tone={absenceTone(a.status)} label={absenceStatusLabel[a.status]} />
                </View>
                <Section>
                  <Group>
                    <Row icon="calendar" title={absenceWhen(a)} showChevron={false} />
                    <Separator inset={50} />
                    <Row icon="document" title={absenceReasonLabel[a.reason]} subtitle={a.comment || undefined} showChevron={false} />
                    {a.requestId ? (
                      <>
                        <Separator inset={50} />
                        <Row icon="mail" title={a.number ? `Request R-${a.number}` : 'Request'} subtitle="Messages with the office" onPress={() => open(`request/${a.requestId}`)} />
                      </>
                    ) : null}
                  </Group>
                </Section>
                {a.reviewNote ? (
                  <Section title="Note from the office">
                    <Text variant="body">{a.reviewNote}</Text>
                  </Section>
                ) : null}
                {!stopped && (
                  <Section title="Progress">
                    <Group>
                      {steps.map((st, i) => (
                        <View key={st.label}>
                          {i > 0 && <Separator inset={50} />}
                          <Row
                            icon={i <= reached ? 'check' : 'clock'}
                            title={st.label}
                            subtitle={i <= reached ? st.text : undefined}
                            showChevron={false}
                            accessibilityLabel={`${st.label}, ${i <= reached ? 'done' : 'not yet'}`}
                          />
                        </View>
                      ))}
                    </Group>
                  </Section>
                )}
                <Section footer={`Sent ${relative(new Date(a.createdAt)).toLowerCase()}.`}>
                  {canCancel &&
                    (confirming ? (
                      <View style={{ gap: spacing.sm }}>
                        <Text variant="subhead">Cancel this report? The office will see that you cancelled it.</Text>
                        <Button
                          label="Cancel report"
                          variant="destructive"
                          loading={cancel.isPending}
                          onPress={() =>
                            cancel.mutate(a.id, {
                              onSuccess: () => {
                                haptic('success');
                                setConfirming(false);
                                void q.refetch();
                              },
                              onError: () => haptic('error'),
                            })
                          }
                        />
                        <TextButton label="Keep report" onPress={() => setConfirming(false)} />
                        {cancel.isError && (
                          <Text variant="footnote" tone="danger" accessibilityRole="alert">
                            {cancel.error.message}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Button label="Cancel this report" variant="secondary" onPress={() => setConfirming(true)} />
                    ))}
                </Section>
              </>
            );
          })()
        )}
      </Screen>
    </>
  );
}
