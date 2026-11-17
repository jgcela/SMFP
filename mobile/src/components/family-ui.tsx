// Domain components: children, events, announcements, statuses, quick actions
// and assistant sources.

import { Pressable, StyleSheet, View } from 'react-native';

import type { Announcement, AssistantCard, Child, SchoolEvent } from '@/data/types';
import { relative, time } from '@/lib/dates';
import { childById, eventAudience, type StatusTone } from '@/lib/lookup';
import { useAppState } from '@/state/app-state';
import { spacing, touchTarget } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

import { Icon, type IconName } from './icon';
import { Tag, Text } from './primitives';

// ---------- Children ----------

export function Initial({ child, size = 44 }: { child: Child; size?: number }) {
  const { colors } = useAppTheme();
  const tint = colors.tint;
  return (
    <View style={[s.initial, { width: size, height: size, borderRadius: size / 2, backgroundColor: tint }]}>
      <Text variant={size > 50 ? 'title' : 'headline'} style={{ color: '#FFFFFF' }}>
        {child.firstName.slice(0, 1)}
      </Text>
    </View>
  );
}

export function ChildChip({ child, indicator, onPress, wide }: { child: Child; indicator?: string; onPress: () => void; wide?: boolean }) {
  const { colors, radius } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${child.firstName}${child.grade ? `, ${child.grade}` : ''}${indicator ? `, ${indicator}` : ''}`}
      style={({ pressed }) => [
        s.childChip,
        { backgroundColor: colors.surface, borderRadius: radius, opacity: pressed ? 0.7 : 1 },
        wide ? { flex: 1 } : { width: 172 },
      ]}>
      <Initial child={child} />
      <View style={{ flex: 1 }}>
        <Text variant="headline" numberOfLines={1}>
          {child.firstName}
        </Text>
        {child.grade ? (
          <Text variant="footnote" tone="secondary" numberOfLines={1}>
            {child.grade}
          </Text>
        ) : null}
        {indicator ? (
          <Text variant="caption" tone="warning" numberOfLines={1}>
            {indicator}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------- Events ----------

export function EventRow({ event, onPress }: { event: SchoolEvent; onPress: () => void }) {
  const { colors } = useAppTheme();
  const { family } = useAppState();
  const timed = !event.allDay && !!event.start;
  const tint = event.calendar.color || colors.tint;
  const audience = event.childIds.length ? eventAudience(event, family) : '';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${event.important ? 'Important. ' : ''}${event.title}, ${timed ? time(new Date(event.start!)) : 'all day'}${audience ? `, for ${audience}` : ''}`}
      style={({ pressed }) => [s.eventRow, pressed && { backgroundColor: colors.surfaceMuted }]}>
      <View style={[s.eventBar, { backgroundColor: event.important ? colors.warning : tint }]} />
      <View style={{ width: 64 }}>
        <Text variant="subhead" style={{ fontWeight: '600' }}>
          {timed ? time(new Date(event.start!)) : 'All day'}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="body" numberOfLines={2}>
          {event.title}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {event.important && <Text variant="caption" tone="warning">Important</Text>}
          {audience ? <Tag label={audience} color={colors.tint} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

// ---------- Announcements ----------

export function AnnouncementRow({ item, onPress }: { item: Announcement; onPress: () => void }) {
  const { colors } = useAppTheme();
  const { readIds } = useAppState();
  const unread = !readIds.has(item.id);
  const accent = colors.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${item.important ? 'Important. ' : ''}${item.title}, ${relative(new Date(item.publishedAt))}`}
      style={({ pressed }) => [s.annRow, pressed && { backgroundColor: colors.surfaceMuted }]}>
      <View style={[s.unreadDot, { backgroundColor: unread ? accent : 'transparent' }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="headline" style={{ flex: 1, fontWeight: unread ? '700' : '500' }} numberOfLines={2}>
            {item.title}
          </Text>
          <Text variant="footnote" tone="secondary">
            {relative(new Date(item.publishedAt))}
          </Text>
        </View>
        <Text variant="subhead" tone="secondary" numberOfLines={2}>
          {item.summary || plainText(item.body)}
        </Text>
        {item.important || item.pinned ? (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
            {item.important && <Text variant="caption" tone="danger">Important</Text>}
            {item.pinned && <Text variant="caption" tone="secondary">Pinned</Text>}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ---------- Statuses ----------

/** Markdown body as one line of plain text, for previews. */
export function plainText(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\n\s*[-*+]\s+/g, ' · ')
    .replace(/[#>*_`~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function StatusLabel({ tone, label }: { tone: StatusTone; label: string }) {
  return (
    <Text variant="caption" tone={tone}>
      {label}
    </Text>
  );
}

export function StatusRow({
  title,
  subtitle,
  tone,
  statusLabel,
  childId,
  onPress,
}: {
  title: string;
  subtitle: string;
  tone: StatusTone;
  statusLabel: string;
  childId?: string | null;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const { family } = useAppState();
  const child = childById(family, childId);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}, ${statusLabel}`}
      style={({ pressed }) => [s.statusRow, pressed && { backgroundColor: colors.surfaceMuted }]}>
      {child ? <Initial child={child} size={36} /> : <Icon name="mail" color={colors.tint} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="body" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="footnote" tone="secondary">
          {subtitle}
        </Text>
      </View>
      <StatusLabel tone={tone} label={statusLabel} />
    </Pressable>
  );
}

// ---------- Quick actions ----------

export function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors, radius } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.quick, { backgroundColor: colors.surface, borderRadius: radius, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={icon} color={colors.tint} size={24} />
      <Text variant="footnote" style={{ textAlign: 'center', fontWeight: '600' }} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------- Assistant sources ----------

type SourceCard = Extract<AssistantCard, { kind: 'source' }>;

export function SourceChip({ source, onPress }: { source: SourceCard; onPress?: () => void }) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="link"
      accessibilityLabel={`Source: ${source.title}`}
      style={({ pressed }) => [s.source, { borderColor: colors.separator, backgroundColor: pressed ? colors.surfaceMuted : colors.surface }]}>
      <Icon name="document" size={16} color={colors.tint} />
      <Text variant="footnote" tone="tint" numberOfLines={1} style={{ flexShrink: 1, fontWeight: '600' }}>
        {source.title}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  initial: { alignItems: 'center', justifyContent: 'center' },
  childChip: { flexDirection: 'row', gap: spacing.md, padding: spacing.md, alignItems: 'center' },
  eventRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: spacing.md, paddingRight: spacing.lg, minHeight: touchTarget + 8, alignItems: 'flex-start' },
  eventBar: { width: 4, alignSelf: 'stretch', borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  annRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.md, paddingRight: spacing.lg, paddingLeft: spacing.sm },
  unreadDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: touchTarget + 8 },
  quick: { flex: 1, minHeight: 84, alignItems: 'center', justifyContent: 'center', gap: 6, padding: spacing.sm },
  source: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, maxWidth: '100%', minHeight: 36 },
});
