"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, FlaskConical } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { useMe, useTodaySession } from "@/lib/queries";
import { cn } from "@/lib/utils";

type SubjectTab = "all" | "math" | "physics" | "chemistry";

const SUBJECT_TABS: { id: SubjectTab; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "math", label: "Математика" },
  { id: "physics", label: "Физика" },
  { id: "chemistry", label: "Химия" },
];


export default function TodayPage() {
  const [tab, setTab] = useState<SubjectTab>("all");
  const { data: me } = useMe();
  const { data: session, isLoading } = useTodaySession();
  const firstName = me?.name?.split(" ")[0] ?? "ученик";

  const isOge = me?.grade != null && me.grade <= 9;
  const examTag = isOge ? "ОГЭ · Математика" : "ЕГЭ · Профильная математика";
  const examTitle = isOge ? "Часть 1 — Алгебра и геометрия" : "Задания №1–12 (Часть 1)";

  const prefix = isOge ? "ОГЭ" : "ЕГЭ";
  const comingSoonCourses = [
    {
      subject: "physics" as SubjectTab,
      tag: `${prefix} · Физика`,
      title: `№1–20 ${prefix} по физике`,
      description: "Механика, термодинамика, электродинамика и квантовая физика",
    },
    {
      subject: "chemistry" as SubjectTab,
      tag: `${prefix} · Химия`,
      title: `№1–20 ${prefix} по химии`,
      description: "Вещества, реакции, органика и расчётные задачи",
    },
  ];

  const tasks = session?.tasks ?? [];
  const totalMin = tasks.reduce((s, t) => s + t.difficulty * 2, 0);

  const showMath = tab === "all" || tab === "math";
  const showOther = tab === "all" || tab === "physics" || tab === "chemistry";

  const visibleOther = comingSoonCourses.filter(
    (c) => tab === "all" || c.subject === tab,
  );

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-4 md:px-6 pt-8 pb-24 md:py-10 space-y-8">
        {/* Greeting */}
        <div>
          <p className="text-sm text-muted">Привет, {firstName}!</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight">Темы и курсы</h1>
        </div>

        {/* Subject tabs */}
        <div className="flex gap-2 flex-wrap">
          {SUBJECT_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition",
                tab === t.id
                  ? "bg-fg text-bg"
                  : "border border-border text-muted hover:bg-fg/5",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Math course */}
        {showMath && (
          <div className="space-y-3">
            {(tab === "all" || tab === "math") && (
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                Математика
              </p>
            )}
            <div className="rounded-3xl border border-border p-6 space-y-4">
              <div>
                <span className="text-xs font-semibold text-accent">
                  {examTag}
                </span>
                <h2 className="mt-1 text-lg font-bold">
                  {examTitle}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Адаптивные задания по слабым темам + сократический AI‑разбор ошибок
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted">
                  {isLoading ? (
                    <span className="inline-block h-4 w-32 rounded bg-fg/10 animate-pulse" />
                  ) : tasks.length > 0 ? (
                    <span>
                      <span className="font-semibold text-fg">{tasks.length}</span>{" "}
                      задания сегодня · ~{totalMin} мин
                    </span>
                  ) : (
                    <span className="text-success font-medium">Всё сделано на сегодня ✓</span>
                  )}
                </div>
                <Link href="/session">
                  <Button size="sm">
                    {tasks.length > 0 ? "Продолжить" : "Повторить"}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Diagnostic banner */}
        {showMath && (
          <Link href="/diagnostic" className="block">
            <div className="rounded-2xl border border-accent/30 bg-accent/5 px-5 py-4 flex items-center gap-4 hover:bg-accent/10 transition">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                <FlaskConical className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Диагностика знаний</p>
                <p className="text-xs text-muted mt-0.5">{isOge ? "14" : "12"} заданий из варианта — узнай свои слабые места</p>
              </div>
              <Lock className="h-4 w-4 text-muted shrink-0 hidden" />
            </div>
          </Link>
        )}

        {/* Coming soon courses */}
        {showOther && visibleOther.length > 0 && (
          <div className="space-y-3">
            {tab === "all" && (
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                В разработке
              </p>
            )}
            {visibleOther.map((course) => (
              <div
                key={course.title}
                className="relative rounded-3xl border border-border p-6 opacity-50 select-none"
              >
                <div className="absolute right-5 top-5">
                  <span className="flex items-center gap-1 rounded-full bg-fg/10 px-3 py-1 text-xs font-medium">
                    <Lock className="h-3 w-3" />
                    В разработке
                  </span>
                </div>
                <span className="text-xs font-semibold text-muted">
                  {course.tag}
                </span>
                <h2 className="mt-1 text-lg font-bold">{course.title}</h2>
                <p className="mt-1 text-sm text-muted">{course.description}</p>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
