import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View, type ScrollViewInstance } from 'react-native';

import { SourceChip, StatusLabel } from '@/components/family-ui';
import { Icon } from '@/components/icon';
import { Markdown } from '@/components/markdown';
import { Button, Group, haptic, Row, Text, TextButton, webColumn, webHeaderEdge } from '@/components/primitives';
import { EmptyState } from '@/components/states';
import type { AssistantAction, AssistantCard, AssistantMessage } from '@/data/types';
import { requestStatusLabel, requestTone } from '@/lib/lookup';
import { useOpen } from '@/lib/nav';
import { useAsk, useConversation, useDecideAction } from '@/services/queries';
import { portalUrl } from '@/services/session';
import { useAppState } from '@/state/app-state';
import { spacing, touchTarget, type as typeScale } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const SUGGESTED = ['What is on the calendar this week?', 'When is the next day with no school?', 'What is the uniform policy?', 'How do I report an absence?'];

export default function Ask() {
  const params = useLocalSearchParams<{ prefill?: string; conversation?: string }>();
  const router = useRouter();
  const { colors, radius } = useAppTheme();
  const { askAvailable } = useAppState();
  const open = useOpen();
  const [conversationId, setConversationId] = useState<string | null>(params.conversation ?? null);
  const [text, setText] = useState('');
  const scroll = useRef<ScrollViewInstance>(null);

  const convo = useConversation(conversationId);
  const ask = useAsk();
  const decide = useDecideAction(conversationId ?? 'none');

  // Opened from "Ask about this" or from history.
  useEffect(() => {
    if (params.prefill) {
      setConversationId(null);
      setText(params.prefill);
    }
  }, [params.prefill]);
  useEffect(() => {
    if (params.conversation) setConversationId(params.conversation);
  }, [params.conversation]);

  const send = (q: string) => {
    const question = q.trim();
    if (question.length < 2 || ask.isPending) return;
    setText('');
    ask.mutate(
      { conversationId, text: question },
      {
        onSuccess: (c) => {
          setConversationId(c.conversation.id);
          setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 50);
        },
        onError: () => {
          haptic('error');
          setText(question);
        },
      },
    );
  };

  const newConversation = () => {
    setConversationId(null);
    ask.reset();
  };

  const openUrl = (url: string) => void WebBrowser.openBrowserAsync(url.startsWith('/') ? portalUrl(url) : url);

  if (!askAvailable) {
    return <EmptyState icon="ask" title="The assistant isn't available" body="The school hasn't turned on the assistant yet." />;
  }

  const messages = convo.data?.messages ?? [];
  const actions = convo.data?.actions ?? {};

  return (
    <>
      <Stack.Screen
        options={{
          headerLargeTitleEnabled: false,
          headerRight: () => (
            <View style={[{ flexDirection: 'row', gap: spacing.md }, webHeaderEdge]}>
              <TextButton label="History" onPress={() => router.push('/ask/history')} />
              {messages.length > 0 && <TextButton label="New" onPress={newConversation} />}
            </View>
          ),
        }}
      />
      <View style={{ flex: 1, backgroundColor: colors.grouped }}>
        <View style={[s.inputBar, { backgroundColor: colors.bg, borderBottomColor: colors.separator }]}>
          <View style={[{ gap: spacing.sm }, webColumn]}>
            <View style={[s.field, { backgroundColor: colors.surfaceMuted, borderRadius: Math.min(radius, 14) }]}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Ask about your school"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Your question"
                style={[typeScale.body, { flex: 1, color: colors.text, paddingVertical: spacing.md }]}
                returnKeyType="send"
                onSubmitEditing={() => send(text)}
                maxLength={1000}
                maxFontSizeMultiplier={2}
              />
              <Pressable
                onPress={() => send(text)}
                disabled={!text.trim() || ask.isPending}
                accessibilityRole="button"
                accessibilityLabel="Send question"
                style={{ minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center', opacity: text.trim() ? 1 : 0.4 }}>
                {ask.isPending ? <ActivityIndicator color={colors.tint} /> : <Icon name="send" size={28} color={colors.tint} />}
              </Pressable>
            </View>
          </View>
        </View>

        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={[{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }, webColumn]}>
          {ask.isError && (
            <Text variant="subhead" tone="danger" accessibilityRole="alert">
              {ask.error.message}
            </Text>
          )}
          {convo.isError && (
            <Text variant="subhead" tone="danger" accessibilityRole="alert">
              {convo.error.message}
            </Text>
          )}

          {messages.length === 0 && !ask.isPending ? (
            <View style={{ gap: spacing.md }}>
              <Text variant="title" accessibilityRole="header">
                How can I help?
              </Text>
              <Text variant="subhead" tone="secondary">
                I answer from the information your school shared with families, and I show where each answer comes from. I can't see grades or homework. I can also prepare an absence notice or a request for you to review before it is sent.
              </Text>
              <View style={{ gap: spacing.sm }}>
                {SUGGESTED.map((q) => (
                  <Pressable
                    key={q}
                    onPress={() => send(q)}
                    accessibilityRole="button"
                    style={({ pressed }) => [s.suggestion, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderRadius: Math.min(radius, 14) }]}>
                    <Icon name="ask" size={16} color={colors.tint} />
                    <Text variant="body" style={{ flex: 1 }}>
                      {q}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            messages.map((m) => (
              <MessageView
                key={m.id}
                m={m}
                actions={actions}
                onUrl={openUrl}
                onRequest={(id) => open(`request/${id}`)}
                onDecide={(actionId, decision) =>
                  decide.mutate({ actionId, decision }, { onSuccess: () => haptic(decision === 'confirm' ? 'success' : 'light'), onError: () => haptic('error') })
                }
                deciding={decide.isPending ? decide.variables?.actionId : undefined}
                decideError={decide.isError ? { id: decide.variables?.actionId, message: decide.error.message } : undefined}
              />
            ))
          )}
          {ask.isPending && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.tint} />
              <Text variant="subhead" tone="secondary">
                Looking through your school's information…
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </>
  );
}

function ActionCard({
  action,
  onDecide,
  busy,
  error,
}: {
  action: AssistantAction | undefined;
  onDecide: (d: 'confirm' | 'dismiss') => void;
  busy: boolean;
  error?: string;
}) {
  if (!action) return null;
  const title = action.kind === 'absence_notice' ? 'Absence notice (draft)' : 'Request to the office (draft)';
  return (
    <Group style={{ padding: spacing.lg, gap: spacing.sm }}>
      <Text variant="headline">{title}</Text>
      <Text variant="body">{action.summary}</Text>
      {action.status === 'proposed' && !action.expired ? (
        <>
          <Button label="Send to the office" loading={busy} onPress={() => onDecide('confirm')} />
          <TextButton label="Discard" tone="secondary" onPress={() => onDecide('dismiss')} />
          {error ? (
            <Text variant="footnote" tone="danger" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
        </>
      ) : action.status === 'confirmed' ? (
        <Text variant="subhead" tone="success">
          Sent{action.result ? ` as ${action.result}` : ''}. You can follow it in Inbox.
        </Text>
      ) : action.status === 'failed' ? (
        <Text variant="subhead" tone="danger">
          Not sent: {action.result ?? 'please use the form or call the office.'}
        </Text>
      ) : action.status === 'dismissed' ? (
        <Text variant="subhead" tone="secondary">
          Discarded. Nothing was sent.
        </Text>
      ) : (
        <Text variant="subhead" tone="secondary">
          This draft is more than a day old. Ask again or use the form.
        </Text>
      )}
    </Group>
  );
}

function MessageView({
  m,
  actions,
  onUrl,
  onRequest,
  onDecide,
  deciding,
  decideError,
}: {
  m: AssistantMessage;
  actions: Record<string, AssistantAction>;
  onUrl: (url: string) => void;
  onRequest: (id: string) => void;
  onDecide: (actionId: string, d: 'confirm' | 'dismiss') => void;
  deciding?: string;
  decideError?: { id?: string; message: string };
}) {
  const { colors, radius } = useAppTheme();
  if (m.role === 'user') {
    return (
      <View style={[s.userBubble, { backgroundColor: colors.tint, borderRadius: Math.max(radius, 14) }]}>
        <Text variant="body" style={{ color: colors.onTint }}>
          {m.content}
        </Text>
      </View>
    );
  }
  const sources = m.cards.filter((c): c is Extract<AssistantCard, { kind: 'source' }> => c.kind === 'source');
  const requests = m.cards.filter((c): c is Extract<AssistantCard, { kind: 'request' }> => c.kind === 'request');
  const drafts = m.cards.filter((c): c is Extract<AssistantCard, { kind: 'action' }> => c.kind === 'action');
  return (
    <View style={{ gap: spacing.sm }}>
      <Markdown text={m.content} />
      {sources.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text variant="caption" tone="secondary">
            Sources
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {sources.map((src, i) => (
              <SourceChip key={`${src.title}-${i}`} source={src} onPress={src.url ? () => onUrl(src.url!) : undefined} />
            ))}
          </View>
        </View>
      )}
      {requests.map((r) => (
        <Group key={r.id}>
          <Row
            icon="mail"
            title={`R-${r.number}: ${r.subject}`}
            trailing={r.status in requestStatusLabel ? <StatusLabel tone={requestTone(r.status as never)} label={requestStatusLabel[r.status as keyof typeof requestStatusLabel]} /> : undefined}
            onPress={() => onRequest(r.id)}
          />
        </Group>
      ))}
      {drafts.map((d) => (
        <ActionCard
          key={d.actionId}
          action={actions[d.actionId]}
          busy={deciding === d.actionId}
          error={decideError?.id === d.actionId ? decideError.message : undefined}
          onDecide={(decision) => onDecide(d.actionId, decision)}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  inputBar: { padding: spacing.md, gap: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  field: { flexDirection: 'row', alignItems: 'center', paddingLeft: spacing.md },
  suggestion: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, minHeight: touchTarget + 8 },
  userBubble: { alignSelf: 'flex-end', maxWidth: '85%', padding: spacing.md, gap: 4 },
});
