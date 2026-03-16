import { create } from 'zustand';

interface AppState {
  isOnline: boolean;
  profileVersion: number;
  setIsOnline: (online: boolean) => void;
  bumpProfileVersion: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  isOnline: true,
  profileVersion: 0,
  setIsOnline: (online) => set({ isOnline: online }),
  bumpProfileVersion: () =>
    set((state) => ({ profileVersion: state.profileVersion + 1 })),
}));
