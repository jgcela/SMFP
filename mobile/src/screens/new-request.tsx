import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ChoiceField, Field } from '@/components/form';
import { Icon } from '@/components/icon';
import { Button, haptic, Text, TextButton, webColumn } from '@/components/primitives';
import { useCreateRequest } from '@/services/queries';
import { useAppState } from '@/state/app-state';
import { spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const TYPES = [
  { value: 'question', label: 'A question' },
  { value: 'request', label: 'A request (pickup change, records…)' },
] as const;
type Kind = (typeof TYPES)[number]['value'];

export default function NewRequest() {
  const { colors } = useAppTheme();
  const { family } = useAppState();
  const create = useCreateRequest();
  const [childId, setChildId] = useState<string>('none');
  const [type, setType] = useState<Kind>('question');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState<number | null>(null);

  const kids = family?.children ?? [];

  if (sent !== null) {
    return (
      <View style={[s.done, { backgroundColor: colors.bg }]}>
        <Icon name="check" size={56} color={colors.success} />
        <Text variant="title" style={{ textAlign: 'center' }}>
          Sent to the office.
        </Text>
        <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
          Your request is R-{sent}. You'll find the answer in Inbox → Requests.
        </Text>
        <View style={{ alignSelf: 'stretch', marginTop: spacing.lg }}>
          <Button label="Done" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { borderBottomColor: colors.separator }]}>
        <TextButton label="Cancel" onPress={() => router.back()} />
        <Text variant="headline" accessibilityRole="header">
          Ask the office
        </Text>
        <View style={{ width: 56 }} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.body, webColumn]}>
        {kids.length > 0 && (
          <ChoiceField
            label="About"
            value={childId}
            onChange={setChildId}
            options={[{ value: 'none', label: 'The whole family' }, ...kids.map((c) => ({ value: c.id, label: c.firstName }))]}
          />
        )}
        <ChoiceField label="Type" value={type} onChange={setType} options={TYPES.map((t) => ({ value: t.value, label: t.label }))} />
        <Field label="Subject" value={subject} onChangeText={setSubject} maxLength={150} />
        <Field label="Message" value={body} onChangeText={setBody} multiline maxLength={3000} hint="Goes to the school office, not to a teacher." />
        {create.isError && (
          <Text variant="subhead" tone="danger" accessibilityRole="alert">
            {create.error.message} Your message is still here.
          </Text>
        )}
        <Button
          label="Send to the office"
          icon="send"
          loading={create.isPending}
          disabled={!subject.trim() || !body.trim()}
          onPress={() =>
            create.mutate(
              { kind: type, childId: childId === 'none' ? undefined : childId, subject: subject.trim(), body: body.trim() },
              {
                onSuccess: (r) => {
                  haptic('success');
                  setSent(r.number);
                },
                onError: () => haptic('error'),
              },
            )
          }
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
});
