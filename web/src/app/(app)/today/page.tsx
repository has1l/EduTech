"use client";

import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { useMe, useTodaySession } from "@/lib/queries";
import { cn } from "@/lib/utils";

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Лёгкий",
  2: "Средний",
  3: "Сложный",
};

const DIFFICULTY_COLOR: Record<number, string> = {
  1: "text-success",
  2: "text-yellow-500",
  3: "text-danger",
};

export default function TodayPage() {
  const { data: me } = useMe();
  const { data: session, isLoading } = useTodaySession();
  const firstName = me?.name?.split(" ")[0] ?? "ученик";

  const tasks = session?.tasks ?? [];
  const totalMin = tasks.reduce((s, t) => s + t.difficulty * 2, 0);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <section className="rounded-3xl bg-accent p-6 text-accent-fg">
          <p className="text-sm font-medium opacity-80">Сегодня</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Привет, {firstName}!
          </h1>
          <p className="mt-2 text-sm">
            {isLoading
              ? "Подбираем задания..."
              : tasks.length > 0
                ? `${tasks.length} задания · ~${totalMin} минут`
                : "Все задания выполнены 🎉"}
          </p>
        </section>

        <section className="mt-8 space-y-3">
          {isLoading &&
            Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="h-20 rounded-2xl border border-border animate-pulse bg-fg/5"
              />
            ))}

          {!isLoading &&
            tasks.map((task, i) => (
              <Link
                key={task.id}
                href={`/task/${task.id}`}
                className="flex items-center justify-between rounded-2xl border border-border p-4 transition hover:bg-fg/5"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="truncate font-semibold text-sm">
                    {task.question_text}
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 text-xs",
                      DIFFICULTY_COLOR[task.difficulty],
                    )}
                  >
                    {DIFFICULTY_LABEL[task.difficulty]} · {task.difficulty * 2} мин
                  </div>
                </div>
                <span className="shrink-0 text-xl text-muted">→</span>
              </Link>
            ))}

          {!isLoading && tasks.length === 0 && (
            <p className="text-center text-sm text-muted py-8">
              Нет доступных заданий.
            </p>
          )}
        </section>
      </main>
    </>
  );
}
