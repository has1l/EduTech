"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function GatePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const res = await fetch("/api/gate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      router.replace("/");
    } else {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15">
            <Lock className="h-7 w-7 text-accent" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">EduTech</h1>
          <p className="text-sm text-muted">Введи код доступа для продолжения</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Код доступа"
            autoFocus
            className={cn(
              "w-full rounded-xl border bg-bg px-4 py-3 text-sm outline-none transition",
              "focus:border-accent focus:ring-2 focus:ring-accent/20",
              error ? "border-danger" : "border-border",
            )}
          />
          {error && (
            <p className="text-sm text-danger text-center">Неверный код</p>
          )}
          <Button type="submit" size="lg" disabled={loading || !code}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Войти"}
          </Button>
        </form>
      </div>
    </main>
  );
}
