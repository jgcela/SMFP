import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { View } from 'react-native';

import { Group, Row, Screen, Section, Separator } from '@/components/primitives';
import { EmptyState, QueryView } from '@/components/states';
import { useLinks } from '@/services/queries';

export default function Links() {
  const q = useLinks();
  return (
    <>
      <Stack.Screen options={{ title: 'Quick links' }} />
      <Screen>
        <Section footer="Links open in your browser.">
          <QueryView query={q} skeletonRows={3}>
            {(items) =>
              items.length === 0 ? (
                <Group>
                  <EmptyState icon="link" title="No links yet." />
                </Group>
              ) : (
                <Group>
                  {items.map((l, i) => (
                    <View key={l.id}>
                      {i > 0 && <Separator inset={50} />}
                      <Row
                        icon="link"
                        title={l.title}
                        subtitle={l.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        onPress={() => void WebBrowser.openBrowserAsync(l.url)}
                      />
                    </View>
                  ))}
                </Group>
              )
            }
          </QueryView>
        </Section>
      </Screen>
    </>
  );
}
