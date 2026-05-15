"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame } from "lucide-react";
import { useStreak, useBoosterCount } from "@/lib/queries";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/today", label: "Курсы" },
  { href: "/progress", label: "Прогресс" },
  { href: "/booster", label: "Бустер" },
  { href: "/theory", label: "Теория" },
  { href: "/profile", label: "Профиль" },
] as const;

export function AppNav() {
  const pathname = usePathname();
  const { data: streak } = useStreak();
  const { data: boosterCount = 0 } = useBoosterCount();

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
            const isBoosterTab = t.href === "/booster";
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "relative rounded-full px-3 py-1.5 text-sm font-medium transition",
                  active ? "bg-fg text-bg" : "text-muted hover:bg-fg/5",
                )}
              >
                {t.label}
                {isBoosterTab && boosterCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-fg">
                    {boosterCount > 9 ? "9+" : boosterCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full bg-accent/20 px-3 py-1 text-sm font-semibold">
            <Flame className="h-4 w-4" />
            {streak?.current_streak ?? 0}
          </div>
        </div>
      </div>
    </header>
  );
}
