import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EventRow } from '@/components/family-ui';
import { Icon } from '@/components/icon';
import { Chip, ChipRow, Group, Screen, Section, Separator, Text } from '@/components/primitives';
import { EmptyState, QueryView } from '@/components/states';
import type { SchoolEvent } from '@/data/types';
import { dayLabel, fromIsoDate, isoDate, longDate, monthName, sameDay, startOfDay } from '@/lib/dates';
import { useOpen } from '@/lib/nav';
import { useEvents } from '@/services/queries';
import { useAppState } from '@/state/app-state';
import { spacing, touchTarget } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

type Mode = 'agenda' | 'month';

/** True if the event covers the given day. */
function onDay(e: SchoolEvent, day: Date): boolean {
  const d = isoDate(day);
  return e.date <= d && (e.endDate ?? e.date) >= d;
}

export default function Calendar() {
  const { calendarChildIds, setCalendarChildIds, family } = useAppState();
  const { colors } = useAppTheme();
  const open = useOpen();
  const [mode, setMode] = useState<Mode>('agenda');
  const [month, setMonth] = useState(() => startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [selected, setSelected] = useState(() => startOfDay(new Date()));
  const range = useMemo(
    () => (mode === 'month' ? { from: isoDate(month), to: isoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0)) } : undefined),
    [mode, month],
  );
  const q = useEvents(range);

  const kids = family?.children ?? [];

  const filtered = useMemo(() => {
    const list = q.data?.events ?? [];
    if (calendarChildIds.length === 0) return list;
    // A child's events plus whole-school events.
    return list.filter((e) => e.childIds.length === 0 || calendarChildIds.some((cid) => e.childIds.includes(cid)));
  }, [q.data, calendarChildIds]);

  const toggleChild = (id: string) =>
    setCalendarChildIds(calendarChildIds.includes(id) ? calendarChildIds.filter((x) => x !== id) : [...calendarChildIds, id]);

  // Agenda: today onward, grouped by day.
  const agenda = useMemo(() => {
    const today = q.data?.today ?? isoDate(new Date());
    const groups = new Map<string, { day: Date; items: SchoolEvent[] }>();
    for (const e of filtered) {
      if ((e.endDate ?? e.date) < today) continue;
      const key = e.date < today ? today : e.date;
      if (!groups.has(key)) groups.set(key, { day: fromIsoDate(key), items: [] });
      groups.get(key)!.items.push(e);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, g]) => g);
  }, [filtered, q.data?.today]);

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
      <View style={[s.segment, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="tablist">
        {(['agenda', 'month'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === m }}
            style={[s.segmentItem, mode === m && { backgroundColor: colors.surface }]}>
            <Text variant="subhead" style={{ fontWeight: '600' }}>
              {m === 'agenda' ? 'Agenda' : 'Month'}
            </Text>
          </Pressable>
        ))}
      </View>

      {kids.length > 1 && (
        <ChipRow>
          <Chip label="All children" selected={calendarChildIds.length === 0} onPress={() => setCalendarChildIds([])} />
          {kids.map((c) => (
            <Chip
              key={c.id}
              label={c.firstName}
              selected={calendarChildIds.includes(c.id)}
              onPress={() => toggleChild(c.id)}
            />
          ))}
        </ChipRow>
      )}

      <QueryView query={q} skeletonRows={4}>
        {() =>
          mode === 'agenda' ? (
            agenda.length === 0 ? (
              <EmptyState
                icon="calendar"
                title={calendarChildIds.length ? 'No events for this filter.' : 'Nothing on the calendar yet.'}
                action={calendarChildIds.length ? { label: 'Show all children', onPress: () => setCalendarChildIds([]) } : undefined}
              />
            ) : (
              agenda.map((g) => (
                <Section key={g.day.toDateString()} title={dayLabel(g.day) === longDate(g.day) ? longDate(g.day) : `${dayLabel(g.day)} · ${longDate(g.day)}`}>
                  <Group>
                    {g.items.map((e, i) => (
                      <View key={e.id}>
                        {i > 0 && <Separator />}
                        <EventRow event={e} onPress={() => open(`event/${e.id}`)} />
                      </View>
                    ))}
                  </Group>
                </Section>
              ))
            )
          ) : (
            <MonthView
              month={month}
              onMonth={setMonth}
              selected={selected}
              onSelect={setSelected}
              events={filtered}
             
              onOpen={(id) => open(`event/${id}`)}
            />
          )
        }
      </QueryView>
    </Screen>
  );
}

function MonthView({
  month,
  onMonth,
  selected,
  onSelect,
  events,
  onOpen,
}: {
  month: Date;
  onMonth: (d: Date) => void;
  selected: Date;
  onSelect: (d: Date) => void;
  events: SchoolEvent[];
  onOpen: (id: string) => void;
}) {
  const { colors } = useAppTheme();
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array<null>(first.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1))];
  while (cells.length % 7) cells.push(null);
  const today = new Date();
  const dayEvents = events.filter((e) => onDay(e, selected));

  return (
    <>
      <View style={s.monthHeader}>
        <Pressable onPress={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} accessibilityRole="button" accessibilityLabel="Previous month" style={s.arrow}>
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <Icon name="chevron" color={colors.tint} />
          </View>
        </Pressable>
        <Text variant="headline" accessibilityRole="header">
          {monthName(month.getMonth())} {month.getFullYear()}
        </Text>
        <Pressable onPress={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} accessibilityRole="button" accessibilityLabel="Next month" style={s.arrow}>
          <Icon name="chevron" color={colors.tint} />
        </Pressable>
      </View>
      <View style={s.weekRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} variant="caption" tone="secondary" style={s.weekday}>
            {d}
          </Text>
        ))}
      </View>
      <View style={s.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={s.cell} />;
          const evs = events.filter((e) => onDay(e, d));
          const isSel = sameDay(d, selected);
          const isToday = sameDay(d, today);
          const dotColors = [...new Set(evs.map((e) => e.calendar.color || colors.tint))].slice(0, 3);
          return (
            <Pressable
              key={i}
              onPress={() => onSelect(d)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSel }}
              accessibilityLabel={`${longDate(d)}${evs.length ? `, ${evs.length} event${evs.length > 1 ? 's' : ''}` : ''}`}
              style={s.cell}>
              <View style={[s.dayCircle, isSel && { backgroundColor: colors.tint }]}>
                <Text variant="subhead" style={{ color: isSel ? colors.onTint : isToday ? colors.tint : colors.text, fontWeight: isToday || isSel ? '700' : '400' }}>
                  {d.getDate()}
                </Text>
              </View>
              <View style={s.dots}>
                {dotColors.map((c) => (
                  <View key={c} style={[s.dot, { backgroundColor: c }]} />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
      <Section title={dayLabel(selected) === longDate(selected) ? longDate(selected) : `${dayLabel(selected)} · ${longDate(selected)}`}>
        {dayEvents.length === 0 ? (
          <Group>
            <Text variant="subhead" tone="secondary" style={{ padding: spacing.lg }}>
              No events this day.
            </Text>
          </Group>
        ) : (
          <Group>
            {dayEvents.map((e, i) => (
              <View key={e.id}>
                {i > 0 && <Separator />}
                <EventRow event={e} onPress={() => onOpen(e.id)} />
              </View>
            ))}
          </Group>
        )}
      </Section>
    </>
  );
}

const s = StyleSheet.create({
  segment: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.md, borderRadius: 10, padding: 2 },
  segmentItem: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, marginTop: spacing.md },
  arrow: { minWidth: touchTarget, minHeight: touchTarget, alignItems: 'center', justifyContent: 'center' },
  weekRow: { flexDirection: 'row', paddingHorizontal: spacing.sm },
  weekday: { flex: 1, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.sm },
  cell: { width: `${100 / 7}%`, height: 52, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
