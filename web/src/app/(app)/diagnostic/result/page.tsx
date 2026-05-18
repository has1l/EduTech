"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, ChevronRight, Trophy } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useMe, useUpdateProfile } from "@/lib/queries";
import type { DiagnosticResult, DiagnosticSectionResult } from "@/lib/types";

function computeCurrentScore(correct: number, total: number, grade: number | null): number {
  const pct = total > 0 ? correct / total : 0;
  if (grade === 9) {
    if (correct >= 9) return 5;
    if (correct >= 4) return 4;
    return 3;
  }
  if (pct >= 0.75) return 85;
  if (pct >= 0.55) return 70;
  if (pct >= 0.30) return 50;
  return 30;
}

const DIFFICULTY_STYLES: Record<number, { badge: string; label: string }> = {
  1: { badge: "bg-success/15 text-success border-success/20", label: "Лёгкое" },
  2: { badge: "bg-accent/15 text-accent border-accent/20", label: "Среднее" },
  3: { badge: "bg-danger/15 text-danger border-danger/20", label: "Сложное" },
};

function ScoreArc({ correct, total }: { correct: number; total: number }) {
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
  const color = pct >= 75 ? "text-success" : pct >= 50 ? "text-accent" : "text-danger";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={cn("text-6xl font-black tabular-nums", color)}>
        {correct}<span className="text-3xl font-bold text-muted">/{total}</span>
      </div>
      <p className="text-sm text-muted">правильных ответов</p>
    </div>
  );
}

function SectionRow({ s }: { s: DiagnosticSectionResult }) {
  const style = DIFFICULTY_STYLES[s.difficulty] ?? DIFFICULTY_STYLES[2];
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold border", style.badge)}>
        {s.task_number}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{s.title}</p>
        <p className="text-xs text-muted truncate">{s.topic_title}</p>
      </div>
      {s.is_correct ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
      ) : (
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-xs text-muted tabular-nums">→ {s.correct_answer}</span>
          <XCircle className="h-5 w-5 text-danger" />
        </div>
      )}
    </div>
  );
}

function getVerdict(pct: number): { title: string; sub: string } {
  if (pct >= 80) return { title: "Отличный результат!", sub: "Ты хорошо знаешь базу — закрепляем и идём вперёд" };
  if (pct >= 60) return { title: "Хорошая база", sub: "Есть пробелы — AI-разбор поможет их закрыть" };
  if (pct >= 40) return { title: "Есть над чем работать", sub: "Много слабых тем — но именно это и покажет план" };
  return { title: "Начинаем с основ", sub: "Не переживай — персональный план всё разложит по полочкам" };
}

export default function DiagnosticResultPage() {
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [scoreSaved, setScoreSaved] = useState(false);
  const { data: me } = useMe();
  const updateProfile = useUpdateProfile();

  // Parse from sessionStorage immediately so UI shows without waiting for me
  useEffect(() => {
    const raw = sessionStorage.getItem("diagnostic_result");
    if (!raw) return;
    try {
      const parsed: DiagnosticResult = JSON.parse(raw);
      setResult(parsed);
      sessionStorage.removeItem("diagnostic_result");
    } catch {}
  }, []);

  // Save score once we have both the result and the user's grade
  useEffect(() => {
    if (!result || !me || scoreSaved) return;
    setScoreSaved(true);
    const score = computeCurrentScore(result.correct, result.total, me.grade);
    if (me.grade === 9) {
      updateProfile.mutate({ oge_current_score: score });
    } else {
      updateProfile.mutate({ current_score: score });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, me?.grade]);

  if (!result) {
    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-md px-6 py-16 text-center text-muted">
          Результаты не найдены.{" "}
          <Link href="/diagnostic" className="text-accent underline">
            Пройти диагностику
          </Link>
        </main>
      </>
    );
  }

  const pct = result.total > 0 ? Math.round((result.correct / result.total) * 100) : 0;
  const verdict = getVerdict(pct);
  const weakSections = result.sections.filter((s) => !s.is_correct);
  const strongSections = result.sections.filter((s) => s.is_correct);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-md px-4 py-8 space-y-8">
        {/* Score header */}
        <div className="rounded-3xl border border-border bg-card p-6 flex flex-col items-center gap-4 text-center">
          <Trophy className="h-10 w-10 text-accent" />
          <ScoreArc correct={result.correct} total={result.total} />
          <div>
            <p className="font-bold text-base">{verdict.title}</p>
            <p className="text-sm text-muted mt-0.5">{verdict.sub}</p>
          </div>
        </div>

        {/* Section results */}
        <div className="rounded-2xl border border-border bg-card px-4 py-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted py-2">
            Результаты по заданиям
          </p>
          {result.sections.map((s) => (
            <SectionRow key={s.task_number} s={s} />
          ))}
        </div>

        {/* Weak areas summary */}
        {weakSections.length > 0 && (
          <div className="rounded-2xl border border-danger/20 bg-danger/5 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-danger">Слабые места ({weakSections.length})</p>
            {weakSections.map((s) => (
              <p key={s.task_number} className="text-sm text-muted">
                · Задание {s.task_number} — {s.title}
              </p>
            ))}
          </div>
        )}

        {strongSections.length > 0 && (
          <div className="rounded-2xl border border-success/20 bg-success/5 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-success">Сильные стороны ({strongSections.length})</p>
            {strongSections.map((s) => (
              <p key={s.task_number} className="text-sm text-muted">
                · Задание {s.task_number} — {s.title}
              </p>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col gap-3">
          <Link href="/today">
            <Button className="w-full" size="lg">
              Начать обучение по плану
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
          <Link href="/diagnostic" className="text-center text-sm text-muted hover:text-fg transition">
            Пройти заново
          </Link>
        </div>
      </main>
    </>
  );
}
