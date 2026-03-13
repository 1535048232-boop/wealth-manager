import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { Database } from "@/types/supabase";

// expo-secure-store is native-only; fall back to localStorage on Web.
// Guard with typeof to avoid SSR crash (localStorage is undefined on server).
const storage =
  Platform.OS === "web"
    ? {
        getItem: (key: string) => {
          if (typeof localStorage === "undefined") return Promise.resolve(null);
          return Promise.resolve(localStorage.getItem(key));
        },
        setItem: (key: string, value: string) => {
          if (typeof localStorage !== "undefined")
            localStorage.setItem(key, value);
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          if (typeof localStorage !== "undefined") localStorage.removeItem(key);
          return Promise.resolve();
        },
      }
    : {
        getItem: (key: string) => SecureStore.getItemAsync(key),
        setItem: (key: string, value: string) =>
          SecureStore.setItemAsync(key, value),
        removeItem: (key: string) => SecureStore.deleteItemAsync(key),
      };

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === "web",
  },
});
