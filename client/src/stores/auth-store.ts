import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from "zustand/middleware";
import type { USER_ROLE } from "../../../api/src/const";

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string | null;
  avatar: string | null;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isHydrated: boolean;
  setSession: (session: AuthSession) => void;
  setUser: (user: AuthUser | null) => void;
  clearSession: () => void;
}

const getWebStorage = () =>
  typeof window === "undefined" ? null : window.localStorage;

// SecureStore is native-only; web falls back to localStorage.
const storage: StateStorage = {
  getItem: async (key) =>
    Platform.OS === "web"
      ? (getWebStorage()?.getItem(key) ?? null)
      : SecureStore.getItemAsync(key),
  setItem: async (key, value) => {
    if (Platform.OS === "web") {
      getWebStorage()?.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  removeItem: async (key) => {
    if (Platform.OS === "web") {
      getWebStorage()?.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isHydrated: false,
      setSession: ({ user, accessToken, refreshToken }) =>
        set({ user, accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      clearSession: () =>
        set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: "auth-session",
      storage: createJSONStorage(() => storage),
      partialize: ({ accessToken, refreshToken }) => ({
        accessToken,
        refreshToken,
      }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn("Failed to restore auth session", error);
        }
        useAuthStore.setState({ isHydrated: true });
      },
    },
  ),
);
