"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth";
import type { BoosterItem, KBStats, PlanOut, ScorePrediction, SessionPath, Streak, Task, TodaySession, User } from "./types";

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
  oge_current_score?: number;
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

export function useScorePrediction() {
  const tokens = useAuth((s) => s.tokens);
  return useQuery({
    queryKey: ["progress", "score-prediction"],
    enabled: !!tokens,
    staleTime: 23 * 60 * 60 * 1000, // server caches 24h
    queryFn: async () => {
      const { data } = await api.get<ScorePrediction>("/progress/score-prediction");
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

// ─── Booster ─────────────────────────────────────────────────────────────────

const BOOSTER_KEY = ["booster"] as const;

export function useBooster() {
  const tokens = useAuth((s) => s.tokens);
  return useQuery({
    queryKey: BOOSTER_KEY,
    enabled: !!tokens,
    queryFn: async () => {
      const { data } = await api.get<BoosterItem[]>("/booster");
      return data;
    },
  });
}

export function useBoosterCount() {
  const tokens = useAuth((s) => s.tokens);
  return useQuery({
    queryKey: [...BOOSTER_KEY, "count"],
    enabled: !!tokens,
    queryFn: async () => {
      const { data } = await api.get<{ count: number }>("/booster/count");
      return data.count;
    },
  });
}

export function useAddToBooster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { task_id: string; topic_id?: string; reason: string; question_preview: string }) => {
      await api.post<BoosterItem>("/booster", item);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOSTER_KEY });
    },
  });
}

export function useRemoveFromBooster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      await api.delete(`/booster/${taskId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOSTER_KEY });
    },
  });
}

export function useUpdateBoosterReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, reason }: { taskId: string; reason: string }) => {
      await api.patch(`/booster/${taskId}/reason`, { reason });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BOOSTER_KEY });
    },
  });
}

// ─── Knowledge Base ───────────────────────────────────────────────────────────

const KB_KEY = ["kb"] as const;

export function useKBStats() {
  const tokens = useAuth((s) => s.tokens);
  return useQuery({
    queryKey: KB_KEY,
    enabled: !!tokens,
    queryFn: async () => {
      const { data } = await api.get<KBStats>("/kb/stats");
      return data;
    },
  });
}

export function useAddToKB() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { task_id: string; topic_id?: string }) => {
      await api.post("/kb", item);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KB_KEY });
    },
  });
}

export function useClearKB() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.post("/kb/clear", {});
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KB_KEY });
    },
  });
}
