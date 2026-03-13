import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { useAuthStore } from "@/stores/authStore";

export function useProtectedRoute() {
  const { session, initialized } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      // Not logged in and not on an auth screen → go to login
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      // Already logged in and on an auth screen → go to home
      router.replace("/(tabs)");
    }
  }, [session, initialized, segments]);
}
