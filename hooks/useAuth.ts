import { useEffect } from "react";
import { type Href, useLocalSearchParams, useRouter, useSegments } from "expo-router";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { useAuthStore } from "@/stores/authStore";

function toSafeHref(value: string): Href | null {
  return value.startsWith("/") ? (value as Href) : null;
}

function getRecoveryUrl(url: string | null) {
  if (!url) return null;

  const [baseAndQuery, hash = ""] = url.split("#");
  const query = baseAndQuery.includes("?") ? baseAndQuery.split("?")[1] : "";
  const params = new URLSearchParams([query, hash].filter(Boolean).join("&"));

  return params.get("type") === "recovery" ? url : null;
}

export function useProtectedRoute() {
  const { session, initialized } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const params = useLocalSearchParams<{ redirectTo?: string }>();
  const incomingUrl = Linking.useURL();

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === "(auth)";
    const isInviteRoute = segments[0] === "invite";
    const isPasswordRecoveryRoute = segments[0] === "(auth)" && segments[1] === "reset-password";
    const redirectTo = typeof params.redirectTo === "string" ? params.redirectTo : "";
    const redirectHref = toSafeHref(redirectTo);
    const currentUrl = incomingUrl ?? (Platform.OS === "web" && typeof window !== "undefined" ? window.location.href : null);
    const recoveryUrl = getRecoveryUrl(currentUrl);

    if (recoveryUrl && !isPasswordRecoveryRoute) {
      router.replace(`/(auth)/reset-password?recoveryUrl=${encodeURIComponent(recoveryUrl)}` as Href);
      return;
    }

    if (!session && !inAuthGroup && !isInviteRoute) {
      // Not logged in and not on an auth screen → go to login
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup && !isPasswordRecoveryRoute) {
      // Respect explicit post-login redirect when provided by deep-link pages.
      if (redirectHref) {
        router.replace(redirectHref);
        return;
      }

      // Already logged in and on an auth screen → go to home
      router.replace("/(tabs)");
    }
  }, [session, initialized, segments, params.redirectTo, incomingUrl]);
}
