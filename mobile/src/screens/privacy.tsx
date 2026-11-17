import { Stack } from 'expo-router';

import { Group, Screen, Section, Text } from '@/components/primitives';
import { spacing } from '@/theme/tokens';

const ITEMS: { title: string; body: string }[] = [
  {
    title: 'Your sign-in',
    body: "In the app, your session is kept in the phone's secure storage (the iOS Keychain or Android's encrypted storage). On the web it is a secure cookie. Signing out removes it.",
  },
  {
    title: 'What is saved on this phone',
    body: "Only your session and which announcements you have read. Everything else is loaded from the school portal each time you open the app.",
  },
  {
    title: 'The assistant',
    body: 'Ask only uses information your school shared with your family. Your questions are private to your account.',
  },
  {
    title: 'Who controls your data',
    body: 'St. Mary decides what is shared in this portal. Contact the school office to correct or remove information.',
  },
];

export default function Privacy() {
  return (
    <>
      <Stack.Screen options={{ title: 'Privacy' }} />
      <Screen>
        {ITEMS.map((it) => (
          <Section key={it.title} title={it.title}>
            <Group style={{ padding: spacing.lg }}>
              <Text variant="body">{it.body}</Text>
            </Group>
          </Section>
        ))}
        <Section>
          <Text variant="footnote" tone="secondary">
            This portal is operated for St. Mary Catholic Virtue School.
          </Text>
        </Section>
      </Screen>
    </>
  );
}
