import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ChoiceField, Field } from '@/components/form';
import { Icon } from '@/components/icon';
import { Button, haptic, Text, TextButton, webColumn } from '@/components/primitives';
import type { AbsenceReason, AbsenceType } from '@/data/types';
import { dayLabel, isoDate, schoolDay } from '@/lib/dates';
import { absenceReasonLabel, absenceTypeLabel } from '@/lib/lookup';
import { newIdempotencyKey } from '@/services/api';
import { useSubmitAbsence } from '@/services/queries';
import { useAppState } from '@/state/app-state';
import { spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

/** Values as the portal expects them (24-hour), labels as families read them. */
const TIMES = [
  ['08:30', '8:30 AM'],
  ['09:00', '9:00 AM'],
  ['10:00', '10:00 AM'],
  ['11:00', '11:00 AM'],
  ['12:00', '12:00 PM'],
  ['13:00', '1:00 PM'],
  ['14:00', '2:00 PM'],
  ['15:00', '3:00 PM'],
] as const;

export default function ReportAbsence() {
  const params = useLocalSearchParams<{ childId?: string }>();
  const { colors } = useAppTheme();
  const { family } = useAppState();
  const submit = useSubmitAbsence();
  // One key per form: a double tap or a retry after a timeout sends one notice.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const eligible = (family?.children ?? []).filter((c) => c.canReportAbsence);
  const [childId, setChildId] = useState<string | null>(params.childId ?? (eligible.length === 1 ? eligible[0]!.id : null));
  const [type, setType] = useState<AbsenceType>('absent');
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; out.length < 6; i++) {
      const d = schoolDay(i);
      if (!out.some((x) => isoDate(x) === isoDate(d))) out.push(d);
    }
    return out;
  }, []);
  const [day, setDay] = useState(isoDate(days[0]!));
  const [until, setUntil] = useState(isoDate(days[0]!));
  const [timeOfDay, setTimeOfDay] = useState<string | null>(null);
  const [reason, setReason] = useState<AbsenceReason | null>(null);
  const [comment, setComment] = useState('');
  const [sentId, setSentId] = useState<string | null>(null);

  const needsTime = type !== 'absent';
  const ready = !!childId && !!reason && (!needsTime || !!timeOfDay);

  const send = () => {
    if (!childId || !reason) return;
    submit.mutate(
      {
        childId,
        type,
        dateFrom: day,
        dateTo: type === 'absent' && until > day ? until : day,
        time: needsTime ? (timeOfDay ?? undefined) : undefined,
        reason,
        comment: comment.trim(),
        idempotencyKey,
      },
      {
        onSuccess: (n) => {
          haptic('success');
          setSentId(n.id);
        },
        onError: (err) => {
          haptic('error');
          // A refused notice was not created; a new attempt gets a new key.
          if ((err as { kind?: string }).kind === 'invalid') setIdempotencyKey(newIdempotencyKey());
        },
      },
    );
  };

  if (sentId) {
    const child = eligible.find((c) => c.id === childId);
    return (
      <View style={[s.done, { backgroundColor: colors.bg }]} accessibilityLiveRegion="polite">
        <Icon name="check" size={56} color={colors.success} />
        <Text variant="title" accessibilityRole="header" style={{ textAlign: 'center' }}>
          Sent. The office will see it right away.
        </Text>
        <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
          {child?.firstName}: {absenceTypeLabel[type].toLowerCase()}, {dayLabel(new Date(`${day}T00:00`)).toLowerCase()}. You can follow it in Inbox.
        </Text>
        <View style={{ alignSelf: 'stretch', gap: spacing.sm, marginTop: spacing.lg }}>
          <Button label="Done" onPress={() => router.back()} />
          <TextButton
            label="See it in Inbox"
            onPress={() => {
              router.back();
              router.push(`/inbox/absence/${sentId}` as never);
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={[s.header, { borderBottomColor: colors.separator }]}>
        <TextButton label="Cancel" onPress={() => router.back()} />
        <Text variant="headline" accessibilityRole="header">
          Report absence
        </Text>
        <View style={{ width: 56 }} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.body, webColumn]}>
        {eligible.length === 0 ? (
          <Text variant="subhead" tone="secondary">
            None of your children can be reported here yet. Call the school office to report an absence.
          </Text>
        ) : (
          <ChoiceField label="Child" value={childId} onChange={setChildId} options={eligible.map((c) => ({ value: c.id, label: c.firstName }))} />
        )}
        <ChoiceField
          label="What happened"
          value={type}
          onChange={(t) => {
            setType(t);
            setTimeOfDay(null);
          }}
          options={(['absent', 'late', 'early_dismissal'] as const).map((t) => ({ value: t, label: absenceTypeLabel[t] }))}
        />
        <ChoiceField
          label={type === 'absent' ? 'First day' : 'Day'}
          value={day}
          onChange={(d) => {
            setDay(d);
            if (until < d) setUntil(d);
          }}
          options={days.map((d) => ({ value: isoDate(d), label: dayLabel(d) }))}
        />
        {type === 'absent' && (
          <ChoiceField
            label="Last day"
            value={until}
            onChange={setUntil}
            options={days.filter((d) => isoDate(d) >= day).map((d) => ({ value: isoDate(d), label: isoDate(d) === day ? 'Same day' : dayLabel(d) }))}
          />
        )}
        {needsTime && (
          <ChoiceField
            label={type === 'late' ? 'Expected arrival' : 'Pickup time'}
            value={timeOfDay}
            onChange={setTimeOfDay}
            options={TIMES.map(([value, label]) => ({ value, label }))}
          />
        )}
        <ChoiceField
          label="Reason"
          value={reason}
          onChange={setReason}
          options={(['illness', 'medical_appointment', 'family', 'other'] as const).map((r) => ({ value: r, label: absenceReasonLabel[r] }))}
        />
        <Field label="Comment (optional)" value={comment} onChangeText={setComment} maxLength={500} multiline hint="Only the school office sees this." />
        {submit.isError && (
          <Text variant="subhead" tone="danger" accessibilityRole="alert">
            {submit.error.message.replace(/"My requests"/g, "Inbox")} Your report was not sent.
          </Text>
        )}
        <Button label="Send to the office" onPress={send} loading={submit.isPending} disabled={!ready} />
        <Text variant="footnote" tone="secondary" style={{ textAlign: 'center' }}>
          Report before 8:30 AM when you can.
        </Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth },
  body: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 },
  done: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
});
