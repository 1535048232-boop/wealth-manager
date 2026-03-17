export const APP_CONFIG = {
  name: 'My App',
  version: '1.0.0',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  webBaseUrl: process.env.EXPO_PUBLIC_WEB_BASE_URL,
} as const;
