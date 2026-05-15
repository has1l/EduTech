"use client";

import { useState } from "react";
import { BookOpen, Brain, Flame, RotateCcw, TrendingUp, Zap } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { useMe, useScorePrediction, useSessionPath, useStreak, useKBStats, useClearKB } from "@/lib/queries";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── helpers ────────────────────────────────────────────────────────────────

function Bar({ value, max, className }: { value: number; max: number; className: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-border">
      <div className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-700", className)} style={{ width: `${pct}%` }} />
    </div>
  );
}

const DIFFICULTY_COLOR = { 1: "bg-success", 2: "bg-accent", 3: "bg-danger" } as Record<number, string>;

// ─── components ─────────────────────────────────────────────────────────────

function StreakCard() {
  const { data: streak } = useStreak();
  const current = streak?.current_streak ?? 0;
  const longest = streak?.longest_streak ?? 0;
  const freezes = streak?.freezes_available ?? 0;

  const days = Array.from({ length: 7 }, (_, i) => i < current % 7 || current >= 7);

  return (
    <section className="rounded-3xl border border-border p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent text-accent-fg">
          <Flame className="h-6 w-6" />
        </div>
        <div>
          <p className="text-2xl font-bold leading-tight">{current} <span className="text-base font-normal text-muted">дн. подряд</span></p>
          <p className="text-xs text-muted">Рекорд: {longest} дн. · Заморозок: {freezes}</p>
        </div>
        <div className="ml-auto hidden sm:flex gap-1">
          {days.map((active, i) => (
            <div key={i} className={cn("h-7 w-7 rounded-lg transition", active ? "bg-accent" : "bg-border")} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ScoreCard() {
  const { data: me } = useMe();
  const { data: pred, isLoading } = useScorePrediction();

  const examDate = me?.exam_date;
  const daysLeft = examDate
    ? Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000))
    : null;

  const isOge = pred?.is_oge ?? false;
  const maxPossible = pred?.max_possible ?? (isOge ? 5 : 70);
  const target = pred?.target ?? (me?.target_score ?? (isOge ? 4 : 85));
  const byPlan = pred?.by_plan ?? 0;
  const ifNothing = pred?.if_nothing ?? 0;

  return (
    <section className="rounded-3xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-muted" />
        <span className="font-semibold">Прогноз балла</span>
        {daysLeft !== null && (
          <span className="ml-auto text-sm text-muted">до экзамена {daysLeft} дн.</span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-7 rounded-xl bg-fg/8 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>Цель</span>
                <span className="font-semibold text-fg">{isOge ? `Оценка ${target}` : target}</span>
              </div>
              <Bar value={target} max={maxPossible} className="bg-fg/40" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>По плану занятий</span>
                <span className="font-semibold text-success">{isOge ? `Оценка ${byPlan}` : byPlan}</span>
              </div>
              <Bar value={byPlan} max={maxPossible} className="bg-success" />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>Если ничего не делать</span>
                <span className="font-semibold text-danger">{isOge ? `Оценка ${ifNothing}` : ifNothing}</span>
              </div>
              <Bar value={ifNothing} max={maxPossible} className="bg-danger" />
            </div>
          </div>

          {pred?.explanation && (
            <p className="mt-3 text-xs text-muted leading-relaxed">{pred.explanation}</p>
          )}

          {!isOge && (
            <p className="mt-2 text-[11px] text-muted/60">
              Прогноз по Части 1 (задания 1–12, максимум 70 баллов). Часть 2 не учитывается.
            </p>
          )}
        </>
      )}
    </section>
  );
}

function KnowledgeBaseCard() {
  const { data: path } = useSessionPath();
  const { data: kb } = useKBStats();
  const clearKBMutation = useClearKB();
  const [resetDone, setResetDone] = useState(false);

  const count = kb?.count ?? 0;
  const allNodes = (path?.sections ?? []).flatMap((s) => s.nodes);
  const allCompleted = allNodes.length > 0 && allNodes.every((n) => n.correct_count >= 5);

  async function handleReset() {
    if (!allCompleted) return;
    setResetDone(false);
    try {
      await api.post("/sessions/reset-path", {});
    } catch { /* ignore */ }
    clearKBMutation.mutate(undefined, {
      onSuccess: () => setResetDone(true),
    });
  }

  return (
    <section className="rounded-3xl border border-border overflow-hidden">
      <div className="bg-gradient-to-br from-accent/20 to-accent/5 px-5 pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-2xl">
              {kb?.level_emoji ?? "🌱"}
            </div>
            <div>
              <p className="text-xs text-muted font-medium uppercase tracking-wide">База знаний</p>
              <p className="text-3xl font-bold leading-tight">{count}</p>
              <p className="text-xs text-muted">задач освоено</p>
            </div>
          </div>
          <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">
            {kb?.level_name ?? "Новичок"}
          </span>
        </div>

        {kb?.next_at != null && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted mb-1">
              <span>{kb.level_name}</span>
              <span>{count} / {kb.next_at} до следующего уровня</span>
            </div>
            <div className="h-1.5 rounded-full bg-accent/20 overflow-hidden">
              <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${kb.level_pct}%` }} />
            </div>
          </div>
        )}
        {kb?.next_at == null && count > 0 && (
          <p className="mt-3 text-xs text-accent font-medium">🏆 Максимальный уровень достигнут!</p>
        )}
      </div>

      <div className="px-5 py-4 space-y-2">
        <p className="text-xs text-muted leading-relaxed">
          Здесь собраны все задачи, которые ты решил самостоятельно. Повторяй их, чтобы не забыть.
        </p>
        <button
          onClick={handleReset}
          disabled={!allCompleted || clearKBMutation.isPending}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-fg text-bg py-3 text-sm font-semibold hover:opacity-90 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <RotateCcw className={cn("h-4 w-4", clearKBMutation.isPending && "animate-spin")} />
          {clearKBMutation.isPending ? "Сброс..." : "Повторение — мать учения"}
        </button>
        {resetDone && (
          <p className="text-[11px] text-success text-center font-medium">
            Прогресс сброшен — все подтипы снова доступны в пути
          </p>
        )}
        {!resetDone && !allCompleted && allNodes.length > 0 && (
          <p className="text-[11px] text-muted text-center">
            Пройди все подтипы в пути, чтобы разблокировать сброс
          </p>
        )}
        {!resetDone && allCompleted && (
          <p className="text-[11px] text-muted text-center">
            Сбросит прогресс подтипов — можно начать заново
          </p>
        )}
      </div>
    </section>
  );
}

function TopicMapCard() {
  const { data: path, isLoading } = useSessionPath();

  if (isLoading) {
    return (
      <section className="rounded-3xl border border-border p-5 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen className="h-5 w-5 text-muted" />
          <span className="font-semibold">Карта знаний</span>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 rounded-full bg-fg/8 animate-pulse" />
        ))}
      </section>
    );
  }

  const sections = path?.sections ?? [];
  const allNodes = sections.flatMap((s) => s.nodes);
  const mastered = allNodes.filter((n) => n.correct_count >= 5).length;
  const inProgress = allNodes.filter((n) => n.correct_count > 0 && n.correct_count < 5).length;
  const notStarted = allNodes.filter((n) => n.correct_count === 0).length;

  return (
    <section className="rounded-3xl border border-border p-5">
      <div className="flex items-center gap-2 mb-1">
        <Brain className="h-5 w-5 text-muted" />
        <span className="font-semibold">Карта знаний</span>
      </div>
      <div className="flex gap-3 text-xs mb-5">
        <span className="text-success font-medium">{mastered} освоено</span>
        <span className="text-accent font-medium">{inProgress} в процессе</span>
        <span className="text-muted">{notStarted} не начато</span>
      </div>

      <div className="space-y-5">
        {sections.map((section) => {
          const sectionMastered = section.nodes.filter((n) => n.correct_count >= 5).length;
          const sectionTotal = section.nodes.length;
          const pct = sectionTotal > 0 ? (sectionMastered / sectionTotal) * 100 : 0;
          const color = DIFFICULTY_COLOR[section.difficulty] ?? "bg-accent";

          return (
            <div key={section.task_number}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-bg", color)}>
                  {section.task_number}
                </span>
                <span className="text-sm font-medium flex-1 truncate">{section.title}</span>
                <span className="text-xs text-muted tabular-nums">{sectionMastered}/{sectionTotal}</span>
              </div>

              {/* Section progress bar */}
              <div className="relative h-1.5 rounded-full bg-border overflow-hidden mb-2">
                <div className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-700", color)} style={{ width: `${pct}%` }} />
              </div>

              {/* Individual subtopics */}
              <div className="space-y-1.5 pl-7">
                {section.nodes.map((node) => {
                  const mastery = Math.min(node.correct_count / 5, 1);
                  const nodeColor = node.correct_count >= 5 ? "bg-success" : node.correct_count > 0 ? "bg-accent" : "bg-border";
                  return (
                    <div key={node.topic_id} className="flex items-center gap-2">
                      <span className="text-[11px] text-muted w-6 shrink-0">{node.subtopic_number}</span>
                      <span className="text-xs text-muted flex-1 truncate">{node.title}</span>
                      <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all duration-700", nodeColor)} style={{ width: `${mastery * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-muted/60 w-6 text-right">{node.correct_count}/5</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {sections.length === 0 && (
        <p className="text-sm text-muted text-center py-8">Начни решать задачи — здесь появится твоя карта знаний.</p>
      )}
    </section>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl space-y-5 px-6 py-10">
        <div className="flex items-center gap-3 mb-1">
          <Zap className="h-6 w-6 text-accent" />
          <h1 className="text-2xl font-bold tracking-tight">Прогресс</h1>
        </div>

        <StreakCard />
        <ScoreCard />
        <KnowledgeBaseCard />
        <TopicMapCard />
      </main>
    </>
  );
}
