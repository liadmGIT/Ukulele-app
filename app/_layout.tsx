import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { getStorage } from '@/db';
import { syncContent } from '@/db/seed';
import { initI18n } from '@/i18n';
import { ErrorBoundary } from '@/ui/components/ErrorBoundary';
import { ThemeProvider, useTheme } from '@/ui/ThemeProvider';

/**
 * Everything that has to happen before the first frame.
 *
 * These run synchronously at module load rather than in an effect: the schema
 * has to exist before i18n can read the stored language, and the language has
 * to be known before React lays anything out, because RTL is decided at that
 * moment and cannot be changed afterwards without a relaunch.
 *
 * Running at module scope means a throw here happens before React exists, so no
 * error boundary can catch it — the bundle simply dies and the app shows white.
 * Hence catching it here instead, and rendering the failure rather than
 * becoming it. The app is largely usable without stored progress; it is not
 * usable as a blank screen.
 */
let bootstrapError: Error | null = null;

try {
  getStorage();
  syncContent();
  initI18n();
} catch (error) {
  bootstrapError = error instanceof Error ? error : new Error(String(error));
}

function RootStack() {
  const theme = useTheme();

  return (
    <>
      <StatusBar style={theme.name === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

/** Re-throws a bootstrap failure where the boundary below can see it. */
function BootstrapGate({ children }: { children: React.ReactNode }) {
  if (bootstrapError) throw bootstrapError;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <BootstrapGate>
          <SafeAreaProvider>
            <ThemeProvider>
              <RootStack />
            </ThemeProvider>
          </SafeAreaProvider>
        </BootstrapGate>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
