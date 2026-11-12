import "@/global.css";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { restoreSession } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  const isHydrated = useAuthStore((state) => state.isHydrated);
  const accessToken = useAuthStore((state) => state.accessToken);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!isHydrated) return;
      try {
        await restoreSession();
      } finally {
        if (isMounted) {
          setIsReady(true);
        }
      }
    }

    void init();

    return () => {
      isMounted = false;
    };
  }, [isHydrated]);

  useEffect(() => {
    if (!isReady) return;

    const inAuthGroup = segments[0] === "login";

    if (!accessToken && !inAuthGroup) {
      // User is not authenticated and trying to access a protected screen
      router.replace("/login");
    } else if (accessToken && inAuthGroup) {
      // User is already authenticated and visits login screen
      router.replace("/");
    }
  }, [isReady, accessToken, segments, router]);

  if (!isReady) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#D97757" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="team-member" options={{ headerShown: false }} />
      <Stack.Screen name="team" options={{ headerShown: false }} />
      <Stack.Screen name="org" options={{ headerShown: false }} />
    </Stack>
  );
}
