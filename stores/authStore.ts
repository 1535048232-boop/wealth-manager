import { create } from "zustand";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  initialized: boolean;
  /** true when signup succeeded but email confirmation is still pending */
  pendingEmailConfirmation: boolean;

  initialize: () => Promise<void>;
  signInWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ error: Error | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
  ) => Promise<{ error: Error | null; needsConfirmation: boolean }>;
  resendConfirmationEmail: (email: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  initialized: false,
  pendingEmailConfirmation: false,

  initialize: async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      set({
        session,
        user: session?.user ?? null,
        isLoading: false,
        initialized: true,
      });

      // Listen for auth state changes (login, logout, token refresh, etc.)
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null });
      });
    } catch {
      set({ isLoading: false, initialized: true });
    }
  },

  signInWithEmail: async (email: string, password: string) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (!error && data.session) {
      set({ session: data.session, user: data.session.user, isLoading: false });

      // Ensure a profile row exists for this user (handles cases where the
      // signup trigger may not have fired, e.g. legacy accounts).
      const userId = data.session.user.id;
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", userId)
        .maybeSingle();

      if (!existing) {
        await supabase.from("profiles").insert({
          id: userId,
          email: data.session.user.email ?? email,
          display_name: (data.session.user.email ?? email).split("@")[0],
        });
      }
    } else {
      set({ isLoading: false });
    }
    return { error };
  },

  signUpWithEmail: async (email: string, password: string) => {
    set({ isLoading: true });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ isLoading: false });
      return { error, needsConfirmation: false };
    }

    // Supabase returns a session immediately when email confirmation is disabled.
    // When confirmation is required, session is null but user.identities is not empty.
    const needsConfirmation = !data.session && !!data.user;
    if (data.session) {
      set({
        session: data.session,
        user: data.session.user,
        isLoading: false,
        pendingEmailConfirmation: false,
      });
    } else {
      set({ isLoading: false, pendingEmailConfirmation: needsConfirmation });
    }
    return { error: null, needsConfirmation };
  },

  resendConfirmationEmail: async (email: string) => {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    return { error };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null, pendingEmailConfirmation: false });
  },

  setSession: (session) => {
    set({ session, user: session?.user ?? null });
  },
}));
