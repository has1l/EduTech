"use client";

import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { useMe } from "@/lib/queries";

const MOCK_TASKS = [
  {
    id: "mock-1",
    topic: "Окружность · вписанный угол",
    difficulty: "Средний",
    minutes: 3,
  },
  {
    id: "mock-2",
    topic: "Тригонометрия · преобразование",
    difficulty: "Сложный",
    minutes: 5,
  },
  {
    id: "mock-3",
    topic: "Производная · экстремумы",
    difficulty: "Средний",
    minutes: 4,
  },
];

export default function TodayPage() {
  const { data: me } = useMe();
  const firstName = me?.name?.split(" ")[0] ?? "ученик";

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <section className="rounded-3xl bg-accent p-6 text-accent-fg">
          <p className="text-sm font-medium opacity-80">Сегодня</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">
            Привет, {firstName}!
          </h1>
          <p className="mt-2 max-w-md text-sm">
            {MOCK_TASKS.length} задания · ~
            {MOCK_TASKS.reduce((s, t) => s + t.minutes, 0)} минут
          </p>
        </section>

        <section className="mt-8 space-y-3">
          {MOCK_TASKS.map((t) => (
            <Link
              key={t.id}
              href={`/task/${t.id}`}
              className="flex items-center justify-between rounded-2xl border border-border p-4 transition hover:bg-fg/5"
            >
              <div>
                <div className="font-semibold">{t.topic}</div>
                <div className="text-sm text-muted">
                  {t.difficulty} · {t.minutes} мин
                </div>
              </div>
              <span className="text-2xl text-muted">→</span>
            </Link>
          ))}
        </section>

        <p className="mt-8 text-center text-xs text-muted">
          Это заглушка. Реальные задания подгрузятся, когда подключим
          /sessions/today.
        </p>
      </main>
    </>
  );
}
