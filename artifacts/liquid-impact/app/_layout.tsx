import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppProvider, useApp } from "@/context/AppContext";
import { useAuthStore } from "@/features/auth/store";

SplashScreen.preventAutoHideAsync();

function InitialLayout() {
  const { state } = useApp();
  const segments = useSegments();
  const router = useRouter();
  const { user, initialized, initialize, cleanup } = useAuthStore();

  // Initialize auth session once on mount
  useEffect(() => {
    initialize();
    return () => cleanup();
  }, []);

  useEffect(() => {
    // Wait for both auth and app state to resolve before routing
    if (!initialized || state.hasOnboarded === null) return;

    const seg0 = segments[0] as string | undefined;
    const inAuth = seg0 === "auth";
    const inOnboarding = seg0 === "onboarding";
    const inTabs = seg0 === "(tabs)";

    // Not authenticated → send to auth
    if (!user && !inAuth) {
      router.replace("/auth" as never);
      return;
    }

    // Authenticated but not onboarded → onboarding
    if (user && !state.hasOnboarded && !inOnboarding) {
      router.replace("/onboarding");
      return;
    }

    // Authenticated + onboarded + on auth or onboarding screen → main app
    if (user && state.hasOnboarded && (inAuth || inOnboarding)) {
      router.replace("/(tabs)");
      return;
    }
  }, [user, initialized, state.hasOnboarded, segments]);

  return (
    <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="auth" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen
        name="report"
        options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="paywall"
        options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="settings"
        options={{ headerShown: false, animation: "slide_from_right" }}
      />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <KeyboardProvider>
              <InitialLayout />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </AppProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
