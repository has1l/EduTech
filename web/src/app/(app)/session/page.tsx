"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { MathText } from "@/components/math-text";
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

export default function SessionPage() {
  const { data: me } = useMe();
  const { data: session, isLoading } = useTodaySession();
  const firstName = me?.name?.split(" ")[0] ?? "ученик";

  const tasks = session?.tasks ?? [];
  const totalMin = tasks.reduce((s, t) => s + t.difficulty * 2, 0);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/today" className="text-muted transition hover:text-fg">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs text-muted">ОГЭ · Математика</p>
            <h1 className="text-xl font-bold">Задания на сегодня</h1>
          </div>
        </div>

        <section className="rounded-3xl bg-accent p-6 text-accent-fg mb-8">
          <p className="text-sm font-medium opacity-80">Привет, {firstName}!</p>
          <p className="mt-1 text-lg font-semibold">
            {isLoading
              ? "Подбираем задания..."
              : tasks.length > 0
                ? `${tasks.length} задания · ~${totalMin} минут`
                : "Все задания выполнены 🎉"}
          </p>
        </section>

        <section className="space-y-3">
          {isLoading &&
            Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="h-20 rounded-2xl border border-border animate-pulse bg-fg/5"
              />
            ))}

          {!isLoading &&
            tasks.map((task) => (
              <Link
                key={task.id}
                href={`/task/${task.id}`}
                className="flex items-center justify-between rounded-2xl border border-border p-4 transition hover:bg-fg/5"
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="truncate font-semibold text-sm">
                    <MathText text={task.question_text} />
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
