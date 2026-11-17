import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, SampleDataBanner, Text } from '@/components/primitives';
import { schools } from '@/data/sample';
import { spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

const school = schools[0]!;

export default function Welcome() {
  const { colors } = useAppTheme();
  return (
    <SafeAreaView style={[s.root, { backgroundColor: colors.bg }]}>
      <SampleDataBanner />
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
          <Button label="Sign in" onPress={() => router.push('/sign-in')} />
          <Text variant="footnote" tone="secondary" style={{ textAlign: 'center' }}>
            Use the email and password you use for the St. Mary family portal. New to St. Mary? Ask the front office for access.
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
