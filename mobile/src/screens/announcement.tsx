import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Markdown } from '@/components/markdown';
import { Button, Screen, Section, Text } from '@/components/primitives';
import { QueryView } from '@/components/states';
import { longDate, time } from '@/lib/dates';
import { useAnnouncement } from '@/services/queries';
import { useAppState } from '@/state/app-state';
import { spacing } from '@/theme/tokens';

export default function AnnouncementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useAnnouncement(id);
  const { markRead, askAvailable } = useAppState();

  useEffect(() => {
    if (q.data) markRead(q.data.id);
  }, [q.data, markRead]);

  return (
    <>
      <Stack.Screen options={{ title: 'Announcement' }} />
      <Screen>
        <QueryView query={q}>
          {(a) => {
            const published = new Date(a.publishedAt);
            return (
              <>
                <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm }}>
                  {a.important && (
                    <Text variant="caption" tone="danger">
                      Important
                    </Text>
                  )}
                  <Text variant="title" accessibilityRole="header">
                    {a.title}
                  </Text>
                  <Text variant="footnote" tone="secondary">
                    {longDate(published)}, {time(published)}
                  </Text>
                </View>
                <Section>
                  <Markdown text={a.body} />
                </Section>
                {askAvailable && (
                  <Section footer="Ask answers only from your school's information and shows its sources.">
                    <Button
                      label="Ask about this"
                      icon="ask"
                      variant="secondary"
                      onPress={() => router.push({ pathname: '/ask', params: { prefill: `About the announcement "${a.title}": ` } })}
                    />
                  </Section>
                )}
              </>
            );
          }}
        </QueryView>
      </Screen>
    </>
  );
}
