import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { StatusLabel } from '@/components/family-ui';
import { Field } from '@/components/form';
import { Button, haptic, Screen, Section, Text, TextButton } from '@/components/primitives';
import { QueryView } from '@/components/states';
import type { OfficeRequest, RequestStatus } from '@/data/types';
import { relative } from '@/lib/dates';
import { absenceStatusLabel, absenceTypeLabel, absenceWhen, requestKindLabel, requestOpen, requestStatusLabel, requestTone } from '@/lib/lookup';
import { useCancelRequest, useReplyToRequest, useRequest } from '@/services/queries';
import { spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type Line = { kind: 'message'; mine: boolean; body: string; at: string } | { kind: 'status'; text: string; at: string };

/** The conversation the family sees: their message, replies both ways and status changes. */
function timeline(r: OfficeRequest): Line[] {
  const lines: Line[] = [{ kind: 'message', mine: true, body: r.item.body, at: r.item.createdAt }];
  for (const e of r.events) {
    if (e.kind === 'reply' && e.body) lines.push({ kind: 'message', mine: e.actorKind === 'family', body: e.body, at: e.createdAt });
    else if (e.kind === 'status' && e.toValue && e.toValue in requestStatusLabel) {
      lines.push({ kind: 'status', text: requestStatusLabel[e.toValue as RequestStatus], at: e.createdAt });
    }
  }
  return lines;
}

export default function RequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useRequest(id);
  const reply = useReplyToRequest(id);
  const cancel = useCancelRequest(id);
  const [text, setText] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { colors, radius } = useAppTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Request' }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <Screen>
          <QueryView query={q}>
            {(r) => {
              const open = requestOpen(r.item.status);
              return (
                <>
                  <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.xs }}>
                    <Text variant="footnote" tone="secondary">
                      R-{r.item.number} · {requestKindLabel[r.item.kind]}
                      {r.student ? ` · ${r.student}` : ''}
                    </Text>
                    <Text variant="title" accessibilityRole="header">
                      {r.item.subject}
                    </Text>
                    <StatusLabel tone={requestTone(r.item.status)} label={requestStatusLabel[r.item.status]} />
                  </View>
                  {r.notice ? (
                    <Section title="Absence notice">
                      <Text variant="body">
                        {absenceTypeLabel[r.notice.type]} · {absenceWhen(r.notice)} · {absenceStatusLabel[r.notice.status]}
                      </Text>
                    </Section>
                  ) : null}
                  <Section>
                    <View style={{ gap: spacing.md }}>
                      {timeline(r).map((m, i) =>
                        m.kind === 'status' ? (
                          <Text key={i} variant="caption" tone="secondary" style={{ textAlign: 'center' }}>
                            {m.text} · {relative(new Date(m.at))}
                          </Text>
                        ) : (
                          <View
                            key={i}
                            style={[
                              s.bubble,
                              {
                                alignSelf: m.mine ? 'flex-end' : 'flex-start',
                                backgroundColor: m.mine ? colors.tint : colors.surface,
                                borderRadius: Math.max(radius, 14),
                              },
                            ]}
                            accessibilityLabel={`${m.mine ? 'You' : 'School office'}, ${relative(new Date(m.at))}: ${m.body}`}>
                            <Text variant="caption" style={{ color: m.mine ? colors.onTint : colors.textSecondary }}>
                              {m.mine ? 'You' : 'School office'} · {relative(new Date(m.at))}
                            </Text>
                            <Text variant="body" style={{ color: m.mine ? colors.onTint : colors.text }}>
                              {m.body}
                            </Text>
                          </View>
                        ),
                      )}
                    </View>
                  </Section>
                  {open && (
                    <Section footer="Your reply goes to the school office, not to a teacher.">
                      <View style={{ gap: spacing.sm }}>
                        <Field label="Reply" value={text} onChangeText={setText} multiline maxLength={3000} error={reply.isError ? reply.error.message : undefined} />
                        <Button
                          label="Send reply"
                          icon="send"
                          disabled={!text.trim()}
                          loading={reply.isPending}
                          onPress={() =>
                            reply.mutate(text.trim(), {
                              onSuccess: () => {
                                haptic('success');
                                setText('');
                                void q.refetch();
                              },
                              onError: () => haptic('error'),
                            })
                          }
                        />
                      </View>
                    </Section>
                  )}
                  {open && r.item.kind !== 'attendance' && (
                    <Section>
                      {confirmCancel ? (
                        <View style={{ gap: spacing.sm }}>
                          <Text variant="subhead">Cancel this request? The office will see that you no longer need help with it.</Text>
                          {cancel.isError ? (
                            <Text variant="footnote" tone="danger">
                              {cancel.error.message}
                            </Text>
                          ) : null}
                          <Button
                            label="Cancel request"
                            variant="destructive"
                            loading={cancel.isPending}
                            onPress={() => cancel.mutate(undefined, { onSuccess: () => void q.refetch().then(() => setConfirmCancel(false)) })}
                          />
                          <TextButton label="Keep it open" onPress={() => setConfirmCancel(false)} />
                        </View>
                      ) : (
                        <TextButton label="Cancel this request" tone="danger" onPress={() => setConfirmCancel(true)} />
                      )}
                    </Section>
                  )}
                </>
              );
            }}
          </QueryView>
        </Screen>
      </KeyboardAvoidingView>
    </>
  );
}

const s = StyleSheet.create({
  bubble: { maxWidth: '85%', padding: spacing.md, gap: 4 },
});
