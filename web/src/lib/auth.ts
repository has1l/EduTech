"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TokenPair, User } from "./types";

type AuthState = {
  user: User | null;
  tokens: TokenPair | null;
  setSession: (user: User, tokens: TokenPair) => void;
  setUser: (user: User) => void;
  setTokens: (tokens: TokenPair) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      setSession: (user, tokens) => set({ user, tokens }),
      setUser: (user) => set({ user }),
      setTokens: (tokens) => set({ tokens }),
      clear: () => set({ user: null, tokens: null }),
    }),
    {
      name: "edutech-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ user: s.user, tokens: s.tokens }),
    },
  ),
);

export function getAccessToken(): string | null {
  return useAuth.getState().tokens?.access_token ?? null;
}

export function getRefreshToken(): string | null {
  return useAuth.getState().tokens?.refresh_token ?? null;
}
