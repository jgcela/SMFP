import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, useColorScheme, View } from 'react-native';

import { ApiError } from '@/services/api';
import { AppStateProvider, useAppState } from '@/state/app-state';

function RootStack() {
  const { auth } = useAppState();
  const scheme = useColorScheme();
  const signedIn = auth === 'signed_in';
  // Wait for the saved session before choosing screens, so a reload keeps the page you were on.
  if (auth === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: scheme === 'dark' ? '#000' : '#F2F2F7' }}>
        <ActivityIndicator accessibilityLabel="Loading" />
      </View>
    );
  }
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="sign-in" options={{ headerShown: true, title: 'Sign in', headerBackTitle: 'Back' }} />
          <Stack.Screen name="two-step" options={{ headerShown: true, title: 'Two-step sign-in', headerBackTitle: 'Back' }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="report-absence"
            options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9], sheetGrabberVisible: true, headerShown: false }}
          />
          <Stack.Screen
            name="new-request"
            options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9], sheetGrabberVisible: true, headerShown: false }}
          />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            // Retry once on a network hiccup; never when signed out, refused or gone.
            retry: (count, error) => !(error instanceof ApiError && error.kind !== 'network') && count < 1,
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <AppStateProvider>
        <RootStack />
      </AppStateProvider>
    </QueryClientProvider>
  );
}
