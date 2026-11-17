import { router, Stack } from 'expo-router';
import { Linking, View } from 'react-native';

import { Button, Group, Row, Screen, Section, Separator } from '@/components/primitives';
import { useAppState } from '@/state/app-state';
import { spacing } from '@/theme/tokens';

export default function Contact() {
  const { family } = useAppState();
  const s = family?.school;
  if (!s) return null;
  const rows = [
    s.phone && <Row icon="phone" title={s.phone} subtitle="Call the front office" onPress={() => void Linking.openURL(`tel:${s.phone!.replace(/[^\d+]/g, '')}`)} />,
    s.email && <Row icon="mail" title={s.email} subtitle="Send an email" onPress={() => void Linking.openURL(`mailto:${s.email}`)} />,
    s.address && <Row icon="location" title={s.address} subtitle="Open in Maps" onPress={() => void Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(s.address!)}`)} />,
    s.officeHours && <Row icon="clock" title="Office hours" subtitle={s.officeHours} showChevron={false} />,
    s.websiteUrl && <Row icon="link" title="School website" subtitle={s.websiteUrl.replace(/^https?:\/\//, '')} onPress={() => void Linking.openURL(s.websiteUrl!)} />,
  ].filter(Boolean);
  return (
    <>
      <Stack.Screen options={{ title: 'Contact school' }} />
      <Screen>
        <Section title={s.name}>
          <Group>
            {rows.map((r, i) => (
              <View key={i}>
                {i > 0 && <Separator inset={50} />}
                {r}
              </View>
            ))}
          </Group>
          {family.features.requests ? (
            <View style={{ marginTop: spacing.md }}>
              <Button label="Send a question to the office" variant="secondary" icon="mail" onPress={() => router.push('/new-request')} />
            </View>
          ) : null}
        </Section>
      </Screen>
    </>
  );
}
