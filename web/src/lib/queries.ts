"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth";
import type { PlanOut, SessionPath, Streak, Task, TodaySession, User } from "./types";

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
  current_score?: number;
  target_score?: number;
  exam_date?: string;
};

export function useTodaySession() {
  const tokens = useAuth((s) => s.tokens);
  return useQuery({
    queryKey: ["sessions", "today"],
    enabled: !!tokens,
    queryFn: async () => {
      const { data } = await api.get<TodaySession>("/sessions/today");
      return data;
    },
  });
}

export function useSessionPath() {
  const tokens = useAuth((s) => s.tokens);
  return useQuery({
    queryKey: ["sessions", "path"],
    enabled: !!tokens,
    queryFn: async () => {
      const { data } = await api.get<SessionPath>("/sessions/path");
      return data;
    },
  });
}

export function useTask(id: string) {
  const tokens = useAuth((s) => s.tokens);
  return useQuery({
    queryKey: ["tasks", id],
    enabled: !!tokens && !!id,
    queryFn: async () => {
      const { data } = await api.get<Task>(`/tasks/${id}`);
      return data;
    },
  });
}

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

export function useStreak() {
  const tokens = useAuth((s) => s.tokens);
  return useQuery({
    queryKey: ["streak"],
    enabled: !!tokens,
    queryFn: async () => {
      const { data } = await api.get<Streak>("/streak");
      return data;
    },
  });
}

export function useStudyPlan() {
  const tokens = useAuth((s) => s.tokens);
  return useQuery({
    queryKey: ["plan"],
    enabled: !!tokens,
    queryFn: async () => {
      const { data } = await api.get<PlanOut>("/plan");
      return data;
    },
  });
}

export function useGeneratePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post<PlanOut>("/plan/generate", {});
      return data;
    },
    onSuccess: (data) => {
      qc.setQueryData(["plan"], data);
    },
  });
}
