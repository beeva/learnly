import { useEffect, useState, type ReactNode } from "react";
import { AppState, Platform, View } from "react-native";
import { Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Nunito_700Bold, Nunito_800ExtraBold } from "@expo-google-fonts/nunito";
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";
import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ApiError } from "../src/lib/api";
import { OfflineMissError } from "../src/offline/data";
import { SessionProvider, usePreferences, useSession } from "../src/session/SessionProvider";
import { isOnlineState, startSync } from "../src/sync";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { ToastProvider } from "../src/components/Toast";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

// TanStack Query follows real connectivity and app focus, not the browser defaults.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(isOnlineState(state))),
);

focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener("change", (status) => {
    if (Platform.OS !== "web") handleFocus(status === "active");
  });
  return () => sub.remove();
});

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof OfflineMissError) return false;
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 1;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetry, staleTime: 60_000 },
    mutations: { retry: false },
  },
});

/** Sends signed-out learners to sign in, and signed-in learners away from it. */
function useAuthGate(ready: boolean) {
  const { status } = useSession();
  const segments = useSegments();
  useEffect(() => {
    if (!ready || status === "loading") return;
    const inAuth = segments[0] === "(auth)";
    if (status === "signedOut" && !inAuth) router.replace("/(auth)/sign-in");
    if (status === "signedIn" && inAuth) router.replace("/(tabs)");
  }, [ready, segments, status]);
}

function BackgroundSync() {
  const { status } = useSession();
  useEffect(() => {
    if (status !== "signedIn") return;
    return startSync();
  }, [status]);
  return null;
}

function ThemedApp({ children }: { children: ReactNode }) {
  const { reducedMotion } = usePreferences();
  return <ThemeProvider reducedMotionPreference={reducedMotion}>{children}</ThemeProvider>;
}

function AppStack() {
  const { colors, mode } = useTheme();
  const { status } = useSession();
  const [fontsLoaded, fontError] = useFonts({
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const fontsReady = fontsLoaded || Boolean(fontError);
  const ready = fontsReady && status !== "loading";
  const [splashHidden, setSplashHidden] = useState(false);

  useAuthGate(ready);

  useEffect(() => {
    if (ready && !splashHidden) {
      setSplashHidden(true);
      void SplashScreen.hideAsync().catch(() => undefined);
    }
  }, [ready, splashHidden]);

  if (!fontsReady) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <BackgroundSync />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: "default",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
        <Stack.Screen name="course/[slug]" options={{ animation: "slide_from_right" }} />
        <Stack.Screen name="lesson/[id]" options={{ presentation: "fullScreenModal", gestureEnabled: true }} />
        <Stack.Screen name="practice/[slug]" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
        <Stack.Screen name="diagnostic/[slug]" options={{ presentation: "fullScreenModal", gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <ThemedApp>
              <ToastProvider>
                <AppStack />
              </ToastProvider>
            </ThemedApp>
          </SessionProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

import { analytics } from "../src/analytics/analytics";
import { initI18n } from "../src/i18n/locales";
import { bootReminders, configureReminderHandler } from "../src/notifications/reminders";
import { installWarmup } from "../src/perf/warmup";
import { installSyncHardening } from "../src/sync/hardening";

// Module scope on purpose: these run once per JS bundle load, before the first render,
// so the first screen already speaks the learner's language.
configureReminderHandler();
void initI18n();
installSyncHardening();
installWarmup();
analytics.start();
bootReminders();

