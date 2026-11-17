import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Field } from '@/components/form';
import { Button, haptic, Text, TextButton, webColumn } from '@/components/primitives';
import { useAppState } from '@/state/app-state';
import { spacing } from '@/theme/tokens';
import { useAppTheme } from '@/theme/use-app-theme';

export default function SignIn() {
  const { colors } = useAppTheme();
  const { signIn } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [help, setHelp] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const r = await signIn(email.trim(), password);
    setBusy(false);
    if (!r.ok) {
      haptic('error');
      setError(r.message);
      return;
    }
    if (r.twoStep) router.push('/two-step');
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={[s.body, webColumn]}>
        <Field
          label="Email"
          value={email}
          onChangeText={(t) => {
            setEmail(t);
            setError(null);
          }}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="next"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={(t) => {
            setPassword(t);
            setError(null);
          }}
          secureTextEntry={!show}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          error={error ?? undefined}
          trailing={<TextButton label={show ? 'Hide' : 'Show'} onPress={() => setShow((v) => !v)} />}
        />
        <Button label="Sign in" onPress={() => void submit()} loading={busy} disabled={!email || !password} />
        <View style={{ alignItems: 'center' }}>
          <TextButton label="Forgot your password?" onPress={() => setHelp((v) => !v)} />
          {help && (
            <Text variant="subhead" tone="secondary" style={{ textAlign: 'center' }}>
              Contact the school office. They can send you a new invitation to set your password.
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  body: { padding: spacing.xl, gap: spacing.lg },
});
