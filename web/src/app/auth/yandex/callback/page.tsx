"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { YANDEX_OAUTH_STATE_KEY } from "@/lib/auth-flow";
import type { AuthResponse } from "@/lib/types";

function YandexCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const setSession = useAuth((s) => s.setSession);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const code = params.get("code");
  const state = params.get("state");
  const yandexError = params.get("error_description") ?? params.get("error");
  const redirectUri = useMemo(
    () => process.env.NEXT_PUBLIC_YANDEX_REDIRECT_URI,
    [],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function finishAuth() {
      if (yandexError) {
        throw new Error(yandexError);
      }
      if (!code) {
        throw new Error("Яндекс не вернул код авторизации");
      }
      if (!redirectUri) {
        throw new Error("Yandex ID is not configured");
      }

      const savedState = window.localStorage.getItem(YANDEX_OAUTH_STATE_KEY);
      window.localStorage.removeItem(YANDEX_OAUTH_STATE_KEY);
      if (!state || !savedState || state !== savedState) {
        throw new Error("Не удалось проверить состояние входа через Яндекс");
      }

      const { data } = await api.post<AuthResponse>("/auth/yandex", {
        code,
        redirect_uri: redirectUri,
      });
      setSession(data.user, data.tokens);
      router.replace(data.needs_onboarding ? "/onboarding" : "/today");
    }

    finishAuth().catch((e) => {
      setError(apiErrorMessage(e));
    });
  }, [code, redirectUri, router, setSession, state, yandexError]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Вход через Яндекс</h1>
      {error ? (
        <>
          <p className="mt-3 text-sm text-danger">{error}</p>
          <Link href="/login" className="mt-6 text-sm font-medium underline">
            Вернуться ко входу
          </Link>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">Завершаем авторизацию...</p>
      )}
    </main>
  );
}

export default function YandexCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
          <p className="text-sm text-muted">Загрузка...</p>
        </main>
      }
    >
      <YandexCallbackInner />
    </Suspense>
  );
}
