"use client";

import { AppNav } from "@/components/app-nav";
import { useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Flame, TrendingUp, BookOpen } from "lucide-react";

const MOCK_STREAK = 7;
const MOCK_FREEZES = 2;

const MOCK_SCORE = {
  target: 85,
  current: 58,
  if_nothing: 51,
  if_plan: 83,
  exam_date: "1 июня 2026",
  days_left: 19,
};

const MOCK_TOPICS = [
  { title: "Проценты и доли", mastery: 0.9, status: "green" as const },
  { title: "Степени и корни", mastery: 0.76, status: "green" as const },
  { title: "Уравнения", mastery: 0.64, status: "yellow" as const },
  { title: "Неравенства", mastery: 0.55, status: "yellow" as const },
  { title: "Функции и графики", mastery: 0.48, status: "yellow" as const },
  { title: "Геометрия · треугольники", mastery: 0.3, status: "red" as const },
  { title: "Вписанный угол", mastery: 0.21, status: "red" as const },
  { title: "Тригонометрия", mastery: 0.15, status: "red" as const },
  { title: "Производная", mastery: 0.1, status: "red" as const },
  { title: "Интеграл", mastery: 0.05, status: "red" as const },
];

const STATUS_COLOR = {
  green: "bg-success",
  yellow: "bg-yellow-400",
  red: "bg-danger",
};

const STATUS_LABEL = {
  green: "Знаю",
  yellow: "Учу",
  red: "Слабо",
};

function ScoreBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-border">
        <div
          className={cn("absolute inset-y-0 left-0 rounded-full transition-all", color)}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <span className="w-8 text-right text-sm font-semibold tabular-nums">
        {value}
      </span>
    </div>
  );
}

export default function ProgressPage() {
  const { data: me } = useMe();
  const target = me?.target_score ?? MOCK_SCORE.target;

  const green = MOCK_TOPICS.filter((t) => t.status === "green").length;
  const yellow = MOCK_TOPICS.filter((t) => t.status === "yellow").length;
  const red = MOCK_TOPICS.filter((t) => t.status === "red").length;

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Прогресс</h1>

        {/* Streak */}
        <section className="flex items-center gap-4 rounded-3xl border border-border p-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-2xl font-bold text-accent-fg">
            <Flame className="h-7 w-7" />
          </div>
          <div className="flex-1">
            <div className="text-2xl font-bold">
              {MOCK_STREAK}{" "}
              <span className="text-base font-medium text-muted">
                дней подряд
              </span>
            </div>
            <div className="text-sm text-muted">
              Заморозок: {MOCK_FREEZES} · Личный рекорд: 12
            </div>
          </div>
          <div className="hidden gap-1 sm:flex">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-8 w-8 rounded-lg",
                  i < MOCK_STREAK ? "bg-accent" : "bg-border",
                )}
              />
            ))}
          </div>
        </section>

        {/* Score prediction */}
        <section className="rounded-3xl border border-border p-5">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-muted" />
            <span className="font-semibold">Прогноз балла</span>
            <span className="ml-auto text-sm text-muted">
              до экзамена {MOCK_SCORE.days_left} дн.
            </span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>Цель</span>
                <span>{target}</span>
              </div>
              <ScoreBar value={target} max={100} color="bg-fg" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>По плану занятий</span>
              </div>
              <ScoreBar value={MOCK_SCORE.if_plan} max={100} color="bg-success" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>Если ничего не делать</span>
              </div>
              <ScoreBar value={MOCK_SCORE.if_nothing} max={100} color="bg-danger" />
            </div>
          </div>
          <p className="mt-4 text-sm text-muted">
            Сейчас ты на уровне{" "}
            <span className="font-semibold text-fg">{MOCK_SCORE.current}</span>{" "}
            баллов. Ещё{" "}
            <span className="font-semibold text-fg">
              {target - MOCK_SCORE.current}
            </span>{" "}
            до цели.
          </p>
        </section>

        {/* Knowledge map */}
        <section className="rounded-3xl border border-border p-5">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted" />
            <span className="font-semibold">Карта знаний</span>
            <div className="ml-auto flex gap-2 text-xs">
              <span className="text-success">{green} знаю</span>
              <span className="text-yellow-500">{yellow} учу</span>
              <span className="text-danger">{red} слабо</span>
            </div>
          </div>

          <div className="space-y-2.5">
            {MOCK_TOPICS.map((topic) => (
              <div key={topic.title} className="flex items-center gap-3">
                <div className="w-40 truncate text-sm">{topic.title}</div>
                <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-border">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-all",
                      STATUS_COLOR[topic.status],
                    )}
                    style={{ width: `${topic.mastery * 100}%` }}
                  />
                </div>
                <span
                  className={cn(
                    "w-12 text-right text-xs font-medium",
                    topic.status === "green" && "text-success",
                    topic.status === "yellow" && "text-yellow-500",
                    topic.status === "red" && "text-danger",
                  )}
                >
                  {STATUS_LABEL[topic.status]}
                </span>
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-xs text-muted">
          Данные обновятся после настоящей диагностики.
        </p>
      </main>
    </>
  );
}
