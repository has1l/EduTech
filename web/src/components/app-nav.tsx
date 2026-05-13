"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Flame } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useMe } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/today", label: "Курсы" },
  { href: "/progress", label: "Прогресс" },
  { href: "/theory", label: "Теория" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const clear = useAuth((s) => s.clear);
  const { data: me } = useMe();

  const logout = () => {
    clear();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-6">
        <Link href="/today" className="text-lg font-bold tracking-tight">
          EduTech
        </Link>
        <nav className="flex flex-1 items-center gap-1">
          {TABS.map((t) => {
            const active =
              pathname.startsWith(t.href) ||
              (t.href === "/today" &&
                (pathname.startsWith("/session") || pathname.startsWith("/task")));
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition",
                  active ? "bg-fg text-bg" : "text-muted hover:bg-fg/5",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-1 rounded-full bg-accent/20 px-3 py-1 text-sm font-semibold sm:flex">
            <Flame className="h-4 w-4" /> 0
          </div>
          <span className="hidden text-sm text-muted sm:block">
            {me?.name ?? me?.email ?? "..."}
          </span>
          <Button variant="ghost" size="sm" onClick={logout}>
            Выйти
          </Button>
        </div>
      </div>
    </header>
  );
}
