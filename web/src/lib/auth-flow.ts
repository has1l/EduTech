"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api, apiErrorMessage } from "./api";
import { useAuth } from "./auth";
import type { AuthResponse } from "./types";

type Credentials = { email: string; password: string; name?: string };

async function postAuth(
  path: "/auth/login" | "/auth/register",
  body: Credentials,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>(path, body);
  return data;
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
