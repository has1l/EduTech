"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth";
import type { User } from "./types";

const ME_KEY = ["users", "me"] as const;

export function useMe() {
  const tokens = useAuth((s) => s.tokens);
  return useQuery({
    queryKey: ME_KEY,
    enabled: !!tokens,
    queryFn: async () => {
      const { data } = await api.get<User>("/users/me");
      useAuth.getState().setUser(data);
      return data;
    },
  });
}

export type UpdateProfileInput = {
  name?: string;
  grade?: number;
  target_score?: number;
  exam_date?: string;
};

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const { data } = await api.patch<User>("/users/me", input);
      return data;
    },
    onSuccess: (user) => {
      useAuth.getState().setUser(user);
      qc.setQueryData(ME_KEY, user);
    },
  });
}
