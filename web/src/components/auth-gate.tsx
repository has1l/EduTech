"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const tokens = useAuth((s) => s.tokens);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !tokens) router.replace("/login");
  }, [mounted, tokens, router]);

  if (!mounted || !tokens) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Загрузка...
      </div>
    );
  }

  return <>{children}</>;
}
