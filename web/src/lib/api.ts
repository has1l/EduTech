"use client";

import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import { getAccessToken, getRefreshToken, useAuth } from "./auth";
import type { ApiErrorBody, TokenPair } from "./types";

const baseURL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const api = axios.create({ baseURL });

api.interceptors.request.use((cfg) => {
  const token = getAccessToken();
  if (token) {
    cfg.headers = cfg.headers ?? {};
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

let refreshing: Promise<TokenPair> | null = null;

async function refreshTokens(): Promise<TokenPair> {
  const refresh_token = getRefreshToken();
  if (!refresh_token) throw new Error("no refresh token");
  const { data } = await axios.post<TokenPair>(`${baseURL}/auth/refresh`, {
    refresh_token,
  });
  useAuth.getState().setTokens(data);
  return data;
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError<ApiErrorBody>) => {
    const original = err.config as
      | (AxiosRequestConfig & { _retried?: boolean })
      | undefined;
    const status = err.response?.status;
    const isAuthEndpoint = original?.url?.includes("/auth/");

    if (status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;
      try {
        refreshing ??= refreshTokens().finally(() => {
          refreshing = null;
        });
        const tokens = await refreshing;
        original.headers = original.headers ?? {};
        (original.headers as Record<string, string>).Authorization =
          `Bearer ${tokens.access_token}`;
        return api.request(original);
      } catch {
        useAuth.getState().clear();
      }
    }

    throw err;
  },
);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      return detail.map((d) => d.msg).join("; ");
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Неизвестная ошибка";
}
