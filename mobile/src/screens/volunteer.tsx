import { Stack } from 'expo-router';
import { Linking, View } from 'react-native';

import { Markdown } from '@/components/markdown';
import { Button, Group, Screen, Section, Tag, Text } from '@/components/primitives';
import { EmptyState, QueryView } from '@/components/states';
import { useVolunteer } from '@/services/queries';
import { spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export default function Volunteer() {
  const q = useVolunteer();
  const { colors } = useAppTheme();
  return (
    <>
      <Stack.Screen options={{ title: 'Volunteer' }} />
      <Screen refreshing={q.isRefetching} onRefresh={() => void q.refetch()}>
        <QueryView query={q} skeletonRows={3}>
          {(items) =>
            items.length === 0 ? (
              <EmptyState icon="volunteer" title="No open opportunities right now." body="Check back soon. The school posts new ones during the year." />
            ) : (
              items.map((v) => {
                const meta = [v.schedule, v.location, v.commitment].filter(Boolean).join(' · ');
                return (
                  <Section key={v.id}>
                    <Group style={{ padding: spacing.lg, gap: spacing.sm }}>
                      <Text variant="headline">{v.title}</Text>
                      {meta ? (
                        <Text variant="subhead" tone="secondary">
                          {meta}
                        </Text>
                      ) : null}
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {v.category ? <Tag label={v.category} color={colors.tint} /> : null}
                        {v.organizer ? <Tag label={`Organizer: ${v.organizer}`} color={colors.accent} /> : null}
                      </View>
                      {v.summary ? <Text variant="body">{v.summary}</Text> : null}
                      {v.body ? <Markdown text={v.body} /> : null}
                      {v.actions.map((a) => (
                        <View key={a.url} style={{ marginTop: spacing.xs }}>
                          <Button label={a.label} variant="secondary" icon="link" onPress={() => void Linking.openURL(a.url)} />
                        </View>
                      ))}
                    </Group>
                  </Section>
                );
              })
            )
          }
        </QueryView>
      </Screen>
    </>
  );
}
