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
  { href: "/profile", label: "Профиль" },
] as const;

const WEEK_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function buildActiveDates(lastSessionStr: string | null | undefined, currentStreak: number): Set<string> {
  const set = new Set<string>();
  if (!lastSessionStr || currentStreak <= 0) return set;
  const last = new Date(lastSessionStr);
  last.setHours(0, 0, 0, 0);
  for (let i = 0; i < currentStreak; i++) {
    const d = new Date(last);
    d.setDate(last.getDate() - i);
    set.add(d.toISOString().slice(0, 10));
  }
  return set;
}

export function AppNav() {
  const pathname = usePathname();
  const { data: streak } = useStreak();
  const { data: boosterCount = 0 } = useBoosterCount();

  const current = streak?.current_streak ?? 0;
  const activeDates = buildActiveDates(streak?.last_session_date, current);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const dow = today.getDay();
  const mondayOffset = dow === 0 ? 6 : dow - 1;
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - mondayOffset + i);
    return d;
  });

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

        {/* Streak — always visible inline weekly strip */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-sm font-bold">
            <Flame className="h-4 w-4 text-accent" />
            <span>{current}</span>
          </div>
          <div className="flex gap-1.5">
            {weekDays.map((day, i) => {
              const key = day.toISOString().slice(0, 10);
              const isActive = activeDates.has(key);
              const isToday = key === todayStr;
              const isFuture = day > today;
              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <div
                    className={cn(
                      "h-3 w-3 rounded-full transition-all duration-300",
                      isActive && "bg-accent shadow-sm shadow-accent/50",
                      !isActive && !isFuture && "bg-border",
                      isFuture && "bg-border/30",
                      isToday && !isActive && "ring-2 ring-accent ring-offset-1",
                      isToday && isActive && "ring-2 ring-fg/20 ring-offset-1",
                    )}
                  />
                  <span className={cn(
                    "text-[9px] font-medium leading-none",
                    isToday ? "text-accent font-bold" : "text-muted/50",
                  )}>
                    {WEEK_LABELS[i]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
