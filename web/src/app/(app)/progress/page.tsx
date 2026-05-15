"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { useMe, useSessionPath, useStreak } from "@/lib/queries";
import { getKBCount, getKBLevel, clearKB } from "@/lib/knowledge-base";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── primitives ──────────────────────────────────────────────────────────────

function PxLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-['Press_Start_2P'] text-[9px] leading-relaxed tracking-wider uppercase", className)}>
      {children}
    </span>
  );
}

function PxNum({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("font-['Press_Start_2P'] leading-none tabular-nums", className)}>
      {children}
    </span>
  );
}

function PxCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={cn("border-2 border-fg bg-bg shadow-[4px_4px_0_0_#0a0a0a] relative overflow-hidden", className)}
    >
      {/* scanlines */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,0,0,0.018) 3px,rgba(0,0,0,0.018) 4px)",
        }}
      />
      <div className="relative z-10">{children}</div>
    </section>
  );
}

// Segmented pixel progress bar
function PxBar({
  value,
  max,
  colorClass,
  segments = 16,
}: {
  value: number;
  max: number;
  colorClass: string;
  segments?: number;
}) {
  const filled = max > 0 ? Math.round(Math.min(value / max, 1) * segments) : 0;
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-3.5 flex-1 border border-fg/20",
            i < filled ? colorClass : "bg-fg/5",
          )}
        />
      ))}
    </div>
  );
}

// ─── streak ──────────────────────────────────────────────────────────────────

function StreakCard() {
  const { data: streak } = useStreak();
  const current = streak?.current_streak ?? 0;
  const longest = streak?.longest_streak ?? 0;
  const freezes = streak?.freezes_available ?? 0;

  const weekFilled = current === 0 ? 0 : current % 7 === 0 ? 7 : current % 7;

  return (
    <PxCard>
      {/* header */}
      <div className="border-b-2 border-fg bg-accent px-4 py-3 flex items-center justify-between">
        <PxLabel className="text-fg/70">серия дней</PxLabel>
        <span className="text-lg">🔥</span>
      </div>

      {/* big number */}
      <div className="px-4 pt-4 pb-2 flex items-baseline gap-2">
        <PxNum className="text-4xl text-fg">{current}</PxNum>
        <PxLabel className="text-muted">дн.</PxLabel>
      </div>

      {/* 7-day pixel squares */}
      <div className="px-4 pb-4 space-y-3">
        <div className="flex gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-7 flex-1 border-2 border-fg",
                i < weekFilled ? "bg-accent" : "bg-fg/5",
              )}
            />
          ))}
        </div>
        <div className="flex justify-between">
          <PxLabel className="text-muted">рек: {longest}д</PxLabel>
          <PxLabel className="text-muted">❄ {freezes} замор.</PxLabel>
        </div>
      </div>
    </PxCard>
  );
}

// ─── score ───────────────────────────────────────────────────────────────────

function ScoreCard() {
  const { data: me } = useMe();
  const target = me?.target_score ?? 85;
  const examDate = me?.exam_date;
  const daysLeft = examDate
    ? Math.max(0, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000))
    : null;

  const rows = [
    { label: "ЦЕЛЬ", value: target, max: 100, color: "bg-fg/50", score: String(target) },
    { label: "ПЛАН", value: 83, max: 100, color: "bg-success", score: "83" },
    { label: "СТОП", value: 51, max: 100, color: "bg-danger", score: "51" },
  ];

  return (
    <PxCard>
      <div className="border-b-2 border-fg bg-fg px-4 py-3 flex items-center justify-between">
        <PxLabel className="text-bg">прогноз балла</PxLabel>
        {daysLeft !== null && (
          <PxLabel className="text-bg/50">{daysLeft}д</PxLabel>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex justify-between items-center mb-1.5">
              <PxLabel className="text-muted">{r.label}</PxLabel>
              <PxNum className="text-[11px] text-fg">{r.score}</PxNum>
            </div>
            <PxBar value={r.value} max={r.max} colorClass={r.color} segments={16} />
          </div>
        ))}
        <p className="text-[10px] text-muted/70 font-mono">* уточнится после диагностики</p>
      </div>
    </PxCard>
  );
}

// ─── knowledge base ──────────────────────────────────────────────────────────

const LEVEL_BADGE: Record<string, string> = {
  "Новичок":  "bg-fg/10 text-muted border-fg/20",
  "Ученик":   "bg-success/20 text-success border-success/40",
  "Знаток":   "bg-accent/30 text-fg/70 border-accent/50",
  "Мастер":   "bg-accent text-fg border-accent",
  "Эксперт":  "bg-fg text-bg border-fg",
};

function getLevelMin(name: string): number {
  const map: Record<string, number> = {
    "Новичок": 0, "Ученик": 10, "Знаток": 25, "Мастер": 50, "Эксперт": 100,
  };
  return map[name] ?? 0;
}

function KnowledgeBaseCard() {
  const { data: path } = useSessionPath();
  const [count, setCount] = useState(0);
  const [level, setLevel] = useState({ name: "Новичок", emoji: "🌱", nextAt: 10, count: 0 });
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  useEffect(() => {
    setCount(getKBCount());
    setLevel(getKBLevel());
  }, []);

  const allNodes = (path?.sections ?? []).flatMap((s) => s.nodes);
  const allCompleted = allNodes.length > 0 && allNodes.every((n) => n.correct_count >= 5);

  const lvlMin = getLevelMin(level.name);
  const lvlMax = level.nextAt === Infinity ? lvlMin + 100 : level.nextAt;

  async function handleReset() {
    if (!allCompleted) return;
    setResetting(true);
    setResetDone(false);
    try { await api.post("/sessions/reset-path", {}); } catch { /* ignore */ }
    clearKB();
    setCount(0);
    setLevel(getKBLevel());
    setResetDone(true);
    setResetting(false);
  }

  const badgeClass = LEVEL_BADGE[level.name] ?? LEVEL_BADGE["Новичок"];

  return (
    <PxCard>
      <div className="border-b-2 border-fg bg-fg/5 px-4 py-3 flex items-center justify-between">
        <PxLabel>база знаний</PxLabel>
        <span className={cn("border px-2 py-0.5 font-['Press_Start_2P'] text-[8px]", badgeClass)}>
          {level.emoji} {level.name}
        </span>
      </div>

      <div className="px-4 pt-4 pb-5 space-y-5">
        {/* count */}
        <div className="flex items-baseline gap-3">
          <PxNum className="text-5xl text-fg">{count}</PxNum>
          <span className="text-sm text-muted font-mono">задач освоено</span>
        </div>

        {/* XP bar */}
        <div>
          <div className="flex justify-between mb-2">
            <PxLabel className="text-muted">EXP</PxLabel>
            {level.nextAt !== Infinity ? (
              <PxLabel className="text-muted">{count}&thinsp;/&thinsp;{level.nextAt}</PxLabel>
            ) : (
              <PxLabel className="text-accent">MAX LVL!</PxLabel>
            )}
          </div>
          <PxBar
            value={level.nextAt === Infinity ? 100 : count - lvlMin}
            max={level.nextAt === Infinity ? 100 : lvlMax - lvlMin}
            colorClass="bg-accent"
            segments={20}
          />
        </div>

        {/* reset button */}
        <button
          onClick={handleReset}
          disabled={!allCompleted || resetting}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3.5",
            "border-2 border-fg font-['Press_Start_2P'] text-[9px] tracking-wide",
            "transition-[transform,box-shadow] duration-75",
            allCompleted && !resetting
              ? [
                  "bg-fg text-bg",
                  "shadow-[3px_3px_0_0_hsl(var(--accent))]",
                  "hover:shadow-[1px_1px_0_0_hsl(var(--accent))] hover:translate-x-[2px] hover:translate-y-[2px]",
                  "active:shadow-none active:translate-x-[3px] active:translate-y-[3px]",
                ].join(" ")
              : "bg-fg/10 text-muted cursor-not-allowed",
          )}
        >
          <RotateCcw className={cn("h-3 w-3", resetting && "animate-spin")} />
          {resetting ? "СБРОС..." : "ПОВТОРИТЬ ВСЁ"}
        </button>

        {resetDone && (
          <PxLabel className="text-success block text-center">✓ СБРОС ВЫПОЛНЕН</PxLabel>
        )}
        {!resetDone && !allCompleted && allNodes.length > 0 && (
          <p className="text-[10px] text-muted text-center font-mono">
            пройди все подтипы, чтобы разблокировать сброс
          </p>
        )}
      </div>
    </PxCard>
  );
}

// ─── topic map ───────────────────────────────────────────────────────────────

const DIFF = {
  1: { bar: "bg-success", badge: "bg-success text-bg border-success", dot5: "bg-success", dotPart: "bg-success/60" },
  2: { bar: "bg-accent",  badge: "bg-accent text-fg border-accent",   dot5: "bg-accent",  dotPart: "bg-accent/60"  },
  3: { bar: "bg-danger",  badge: "bg-danger text-bg border-danger",   dot5: "bg-danger",  dotPart: "bg-danger/60"  },
} as Record<number, { bar: string; badge: string; dot5: string; dotPart: string }>;

function TopicMapCard() {
  const { data: path, isLoading } = useSessionPath();
  const [expanded, setExpanded] = useState<number | null>(null);

  if (isLoading) {
    return (
      <PxCard>
        <div className="border-b-2 border-fg bg-fg/5 px-4 py-3">
          <PxLabel>карта знаний</PxLabel>
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 bg-fg/8 animate-pulse" />
          ))}
        </div>
      </PxCard>
    );
  }

  const sections = path?.sections ?? [];
  const allNodes = sections.flatMap((s) => s.nodes);
  const mastered = allNodes.filter((n) => n.correct_count >= 5).length;
  const inProgress = allNodes.filter((n) => n.correct_count > 0 && n.correct_count < 5).length;
  const notStarted = allNodes.filter((n) => n.correct_count === 0).length;

  return (
    <PxCard>
      {/* header */}
      <div className="border-b-2 border-fg bg-fg/5 px-4 py-3 flex items-center justify-between">
        <PxLabel>карта знаний</PxLabel>
        <div className="flex gap-4">
          <PxLabel className="text-success">✓{mastered}</PxLabel>
          <PxLabel className="text-accent">◐{inProgress}</PxLabel>
          <PxLabel className="text-muted">○{notStarted}</PxLabel>
        </div>
      </div>

      {sections.length === 0 && (
        <p className="text-[10px] font-mono text-muted text-center py-10 px-4">
          начни решать задачи — здесь появится карта знаний
        </p>
      )}

      <div className="divide-y divide-fg/10">
        {sections.map((section) => {
          const sectionMastered = section.nodes.filter((n) => n.correct_count >= 5).length;
          const sectionTotal = section.nodes.length;
          const pct = sectionTotal > 0 ? (sectionMastered / sectionTotal) * 100 : 0;
          const d = DIFF[section.difficulty] ?? DIFF[2];
          const isOpen = expanded === section.task_number;

          return (
            <div key={section.task_number}>
              {/* section row */}
              <button
                onClick={() => setExpanded(isOpen ? null : section.task_number)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-fg/4 text-left"
              >
                <span className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center border-2 border-fg",
                  "font-['Press_Start_2P'] text-[8px]",
                  d.badge,
                )}>
                  {section.task_number}
                </span>

                {/* section bar */}
                <div className="flex-1 space-y-1 min-w-0">
                  <span className="text-xs font-medium block truncate">{section.title}</span>
                  <div className="flex gap-0.5 h-2">
                    {Array.from({ length: sectionTotal }).map((_, j) => (
                      <div
                        key={j}
                        className={cn(
                          "flex-1 border border-fg/20",
                          j < sectionMastered ? d.bar : "bg-fg/5",
                        )}
                      />
                    ))}
                  </div>
                </div>

                <PxLabel className="text-muted shrink-0">{sectionMastered}/{sectionTotal}</PxLabel>
                <span className="text-muted/60 text-xs ml-0.5">{isOpen ? "▲" : "▼"}</span>
              </button>

              {/* expanded subtopic grid */}
              {isOpen && (
                <div className="border-t border-fg/10 bg-fg/[0.02] px-4 py-3">
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
                    {section.nodes.map((node) => {
                      const filled = Math.min(node.correct_count, 5);
                      const done = node.correct_count >= 5;
                      const started = node.correct_count > 0;
                      return (
                        <div
                          key={node.topic_id}
                          className={cn(
                            "border p-2 space-y-1.5",
                            done
                              ? "border-success/60 bg-success/5"
                              : started
                                ? "border-accent/50 bg-accent/5"
                                : "border-fg/15",
                          )}
                        >
                          <p className="text-[9px] font-mono text-muted truncate leading-tight">
                            {node.subtopic_number} {node.title}
                          </p>
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, j) => (
                              <div
                                key={j}
                                className={cn(
                                  "h-1.5 flex-1",
                                  j < filled
                                    ? done ? "bg-success" : "bg-accent"
                                    : "bg-fg/10",
                                )}
                              />
                            ))}
                          </div>
                          <PxLabel className={cn(
                            done ? "text-success" : started ? "text-accent" : "text-muted/40",
                          )}>
                            {filled}/5
                          </PxLabel>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PxCard>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        {/* page title */}
        <div className="flex items-center gap-3">
          <PxNum className="text-[15px] text-fg tracking-widest">// ПРОГРЕСС</PxNum>
        </div>

        {/* top row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <StreakCard />
          <ScoreCard />
        </div>

        <KnowledgeBaseCard />
        <TopicMapCard />
      </main>
    </>
  );
}
