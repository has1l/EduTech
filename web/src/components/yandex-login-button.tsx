"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { startYandexAuth } from "@/lib/auth-flow";

export function YandexLoginButton() {
  const [error, setError] = useState<string | null>(null);

  const login = () => {
    try {
      setError(null);
      startYandexAuth();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось открыть Яндекс ID");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" size="lg" onClick={login}>
        Войти через Яндекс ID
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
