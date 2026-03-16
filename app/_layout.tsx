import { useEffect } from 'react';
import { Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '@/stores/authStore';
import { useProtectedRoute } from '@/hooks/useAuth';
import '../global.css';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initialize, initialized } = useAuthStore();
  const [iconsLoaded] = useFonts({
    ...MaterialCommunityIcons.font,
  });

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (initialized && iconsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [initialized, iconsLoaded]);

  useProtectedRoute();

  if (!initialized || !iconsLoaded) return null;

  return <Slot />;
}
