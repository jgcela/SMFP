import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Text } from '@/components/primitives';
import { spacing } from '@/theme/tokens';
import { useAppState } from '@/state/app-state';
import { useAppTheme } from '@/theme/use-app-theme';

/** Shown before sign-in; after sign-in the school's details come from the portal. */
const school = { name: 'St. Mary Catholic Virtue School', primary: '#16335B', accent: '#FCBC40' };

export default function Welcome() {
  const { colors } = useAppTheme();
  const { bootError, retryBoot } = useAppState();
  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.bg }]}>
      <View style={s.body}>
        <View style={s.center}>
          <View style={[s.mark, { backgroundColor: school.primary }]} accessibilityElementsHidden importantForAccessibility="no">
            <Text style={[s.markLetter, { color: school.accent }]}>SM</Text>
          </View>
          <Text variant="largeTitle" accessibilityRole="header" style={{ color: colors.tint, textAlign: 'center' }}>
            {school.name}
          </Text>
          <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
            Everything your family needs, in one place.
          </Text>
        </View>
        <View style={s.actions}>
          {bootError ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="subhead" tone="danger" style={{ textAlign: 'center' }} accessibilityRole="alert">
                {bootError}
              </Text>
              <Button label="Try again" variant="secondary" onPress={retryBoot} />
            </View>
          ) : null}
          <Button label="Sign in" onPress={() => router.push('/sign-in')} />
          <Text variant="footnote" tone="secondary" style={{ textAlign: 'center' }}>
            Use the email and password of your St. Mary family account. New to St. Mary? Ask the front office for an invitation.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.xl },
  // On wide web screens the content stays in a readable column.
  body: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  mark: { width: 88, height: 88, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  markLetter: { fontSize: 38, lineHeight: 46, fontWeight: '800' },
  actions: { gap: spacing.lg, paddingBottom: spacing.xl },
});
