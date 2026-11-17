import { router, Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Group, Row, Screen, Section, Separator, Text, TextButton } from '@/components/primitives';
import { useOpen } from '@/lib/nav';
import { portalUrl } from '@/services/session';
import { useAppState } from '@/state/app-state';
import { spacing } from '@/theme/tokens';

export default function Settings() {
  const { signOut, family } = useAppState();
  const open = useOpen();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Stack.Screen options={{ title: 'Settings' }} />
      <Screen>
        <Section title="Account">
          <Group>
            <Row icon="person" title={family?.user.name ?? ''} subtitle={family?.user.email} showChevron={false} />
            <Separator inset={50} />
            <Row
              icon="lock"
              title="Password and two-step sign-in"
              subtitle="Opens your account security on the portal website"
              onPress={() => void WebBrowser.openBrowserAsync(portalUrl('/account/security'))}
            />
          </Group>
        </Section>

        <Section title="Privacy and help">
          <Group>
            <Row icon="shield" title="Privacy" subtitle="What this app keeps on your device" onPress={() => open('privacy')} />
            <Separator inset={50} />
            <Row icon="help" title="Help" subtitle="Contact the school office for help with your account" onPress={() => open('contact')} />
          </Group>
        </Section>

        <Section>
          {confirmSignOut ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="subhead">Sign out of the St. Mary portal on this device?</Text>
              <Button
                label="Sign out"
                variant="destructive"
                loading={busy}
                onPress={async () => {
                  setBusy(true);
                  await signOut();
                  router.replace('/welcome');
                }}
              />
              <TextButton label="Stay signed in" onPress={() => setConfirmSignOut(false)} />
            </View>
          ) : (
            <Group>
              <Row icon="signOut" title="Sign out" destructive onPress={() => setConfirmSignOut(true)} />
            </Group>
          )}
        </Section>
      </Screen>
    </>
  );
}
