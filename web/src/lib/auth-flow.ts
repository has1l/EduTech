"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api, apiErrorMessage } from "./api";
import { useAuth } from "./auth";
import type { AuthResponse } from "./types";

type Credentials = { email: string; password: string; name?: string };

export const YANDEX_OAUTH_STATE_KEY = "edutech-yandex-oauth-state";

async function postAuth(
  path: "/auth/login" | "/auth/register",
  body: Credentials,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>(path, body);
  return data;
}

function randomState(): string {
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function startYandexAuth() {
  const clientId = process.env.NEXT_PUBLIC_YANDEX_CLIENT_ID;
  const redirectUri = process.env.NEXT_PUBLIC_YANDEX_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    throw new Error("Yandex ID is not configured");
  }

  const state = randomState();
  window.localStorage.setItem(YANDEX_OAUTH_STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "login:info login:email",
    state,
    force_confirm: "yes",
  });

  window.location.assign(`https://oauth.yandex.ru/authorize?${params}`);
}

export function useAuthMutation(mode: "login" | "register") {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);

  return useMutation({
    mutationFn: (creds: Credentials) =>
      postAuth(mode === "login" ? "/auth/login" : "/auth/register", creds),
    onSuccess: (resp) => {
      setSession(resp.user, resp.tokens);
      router.replace(resp.needs_onboarding ? "/onboarding" : "/today");
    },
  });
}

export { apiErrorMessage };
