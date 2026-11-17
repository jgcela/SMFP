import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Linking, View } from 'react-native';

import { Markdown } from '@/components/markdown';
import { Button, Group, Row, Screen, Section, Separator, Tag, Text } from '@/components/primitives';
import { QueryView } from '@/components/states';
import { eventAudience, eventWhen } from '@/lib/lookup';
import { useEvent } from '@/services/queries';
import { portalUrl } from '@/services/session';
import { useAppState } from '@/state/app-state';
import { spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export default function EventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useEvent(id);
  const { colors } = useAppTheme();
  const { family } = useAppState();

  return (
    <>
      <Stack.Screen options={{ title: 'Event' }} />
      <Screen>
        <QueryView query={q}>
          {(e) => (
            <>
              <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl, gap: spacing.sm }}>
                {e.important && (
                  <Text variant="headline" tone="warning">
                    Important
                  </Text>
                )}
                <Text variant="title" accessibilityRole="header">
                  {e.title}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  <Tag label={eventAudience(e, family)} color={colors.tint} />
                  {e.calendar.name ? <Tag label={e.calendar.name} color={e.calendar.color || colors.accent} /> : null}
                </View>
              </View>
              <Section>
                <Group>
                  <Row icon="clock" title={eventWhen(e)} showChevron={false} />
                  {e.location ? (
                    <>
                      <Separator inset={50} />
                      <Row icon="location" title={e.location} showChevron={false} />
                    </>
                  ) : null}
                </Group>
              </Section>
              {e.description ? (
                <Section title="Details">
                  <Markdown text={e.description} />
                </Section>
              ) : null}
              {e.registrationUrl ? (
                <Section title="Links">
                  <Group>
                    <Row icon="link" title="Sign up or learn more" onPress={() => void Linking.openURL(e.registrationUrl!)} />
                  </Group>
                </Section>
              ) : null}
              {family ? (
                <Section footer="Downloads the event so your calendar app can add it.">
                  <Button
                    label="Add to Calendar"
                    icon="calendar"
                    variant="secondary"
                    onPress={() => void WebBrowser.openBrowserAsync(portalUrl(`${family.school.portalPath}/calendar/event/${e.eventId}/ics`))}
                  />
                </Section>
              ) : null}
            </>
          )}
        </QueryView>
      </Screen>
    </>
  );
}
