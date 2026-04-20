import { useEffect } from "react";
import { type Href, useLocalSearchParams, useRouter, useSegments } from "expo-router";
import { useAuthStore } from "@/stores/authStore";

function toSafeHref(value: string): Href | null {
  return value.startsWith("/") ? (value as Href) : null;
}

export function useProtectedRoute() {
  const { session, initialized } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const params = useLocalSearchParams<{ redirectTo?: string }>();

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === "(auth)";
    const isInviteRoute = segments[0] === "invite";
    const redirectTo = typeof params.redirectTo === "string" ? params.redirectTo : "";
    const redirectHref = toSafeHref(redirectTo);

    if (!session && !inAuthGroup && !isInviteRoute) {
      // Not logged in and not on an auth screen → go to login
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      // Respect explicit post-login redirect when provided by deep-link pages.
      if (redirectHref) {
        router.replace(redirectHref);
        return;
      }

      // Already logged in and on an auth screen → go to home
      router.replace("/(tabs)");
    }
  }, [session, initialized, segments, params.redirectTo]);
}
