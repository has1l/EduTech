"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Brain, ChevronLeft, ChevronRight, ClipboardList, Loader2, RefreshCw, Star, Zap, Lock, CheckCircle2 } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { useMe, useSessionPath, useStudyPlan, useGeneratePlan } from "@/lib/queries";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { PathNode, PlanGroup, SubtopicSession, TaskSection } from "@/lib/types";

const ZIGZAG_OFFSETS = [56, 16, -56, -16, 56, 16, -56, -16];

type NodeState = "completed" | "current" | "locked";
type Tab = "path" | "plan";

const SECTION_STYLES: Record<number, { header: string; badge: string; label: string }> = {
  1: {
    header: "border-success/30 bg-success/5",
    badge: "bg-success/20 text-success",
    label: "text-success",
  },
  2: {
    header: "border-accent/30 bg-accent/5",
    badge: "bg-accent/20 text-accent",
    label: "text-accent",
  },
  3: {
    header: "border-danger/30 bg-danger/5",
    badge: "bg-danger/20 text-danger",
    label: "text-danger",
  },
};

const STATUS_STYLES: Record<string, { ring: string; bg: string; badge: string; text: string; label: string }> = {
  weak:   { ring: "border-danger",  bg: "bg-danger/5",   badge: "bg-danger/15 text-danger",   text: "text-danger",  label: "Слабое место" },
  medium: { ring: "border-accent",  bg: "bg-accent/5",   badge: "bg-accent/15 text-accent",   text: "text-accent",  label: "В процессе" },
  strong: { ring: "border-success", bg: "bg-success/5",  badge: "bg-success/15 text-success", text: "text-success", label: "Хорошо" },
};

function SectionHeader({ section }: { section: TaskSection }) {
  const style = SECTION_STYLES[section.difficulty] ?? SECTION_STYLES[2];
  const completedCount = section.nodes.filter((n) => n.state === "completed").length;

  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border px-4 py-3 w-full", style.header)}>
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
          style.badge,
        )}
      >
        {section.task_number}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold leading-tight", style.label)}>
          Задание {section.task_number}
        </p>
        <p className="text-xs text-muted truncate">{section.title}</p>
      </div>
      <span className="text-xs text-muted tabular-nums shrink-0">
        {completedCount}&thinsp;/&thinsp;{section.nodes.length}
      </span>
    </div>
  );
}

function PathNodeItem({
  node,
  offset,
  onTap,
  loading,
}: {
  node: PathNode;
  offset: number;
  onTap: (node: PathNode) => void;
  loading: boolean;
}) {
  const state = node.state as NodeState;
  const isCurrent = state === "current";
  const isCompleted = state === "completed";
  const isLocked = state === "locked";

  const faceBg = isCurrent ? "bg-accent" : isCompleted ? "bg-success" : "bg-[#D6D6D6]";
  const faceText = isCurrent ? "text-accent-fg" : isCompleted ? "text-white" : "text-[#9ca3af]";
  const shadowBg = isCurrent ? "bg-[#a68a00]" : isCompleted ? "bg-[#0a7a52]" : "bg-[#ababab]";

  return (
    <div
      className="flex flex-col items-center"
      style={{ transform: `translateX(${offset}px)` }}
    >
      <button
        onClick={() => !isLocked && !loading && onTap(node)}
        disabled={isLocked || loading}
        className={cn("group relative", isLocked ? "cursor-not-allowed" : "cursor-pointer")}
      >
        {/* Pulsing ring for current */}
        {isCurrent && (
          <span className="absolute top-0 left-0 w-[72px] h-[72px] rounded-full bg-accent/30 animate-ping" />
        )}

        {/* 3D coin: shadow layer below + face layer on top */}
        <div className="relative w-[72px] h-[77px]">
          <div className={cn("absolute bottom-0 left-0 w-[72px] h-[72px] rounded-full", shadowBg)} />
          <div
            className={cn(
              "absolute top-0 left-0 w-[72px] h-[72px] rounded-full flex items-center justify-center transition-transform duration-150",
              faceBg,
              faceText,
              !isLocked && "group-hover:translate-y-[2px] group-active:translate-y-[4px]",
            )}
          >
            {loading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isCurrent ? (
              <Zap className="h-7 w-7 fill-current" />
            ) : isCompleted ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : (
              <Lock className="h-5 w-5" />
            )}
          </div>
        </div>
      </button>

      <p
        className={cn(
          "mt-2 text-center text-xs font-medium max-w-[90px] leading-tight",
          isLocked ? "text-muted/40" : isCompleted ? "text-success" : "text-fg/80",
        )}
      >
        {node.subtopic_number}
      </p>
      <p
        className={cn(
          "text-center text-[11px] max-w-[100px] leading-tight",
          isLocked ? "text-muted/30" : "text-muted",
        )}
      >
        {node.title}
      </p>
    </div>
  );
}

function Connector({ fromOffset, toOffset }: { fromOffset: number; toOffset: number }) {
  const cx = 160;
  const height = 64;
  return (
    <svg
      width="320"
      height={height}
      className="overflow-visible"
      style={{ marginLeft: "-50%", transform: "translateX(50%)" }}
    >
      <line
        x1={cx + fromOffset}
        y1={0}
        x2={cx + toOffset}
        y2={height}
        stroke="hsl(var(--border))"
        strokeWidth="2.5"
        strokeDasharray="5 5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlanGroupCard({ group, priority, onStart }: { group: PlanGroup; priority: number; onStart: () => void }) {
  const st = STATUS_STYLES[group.status] ?? STATUS_STYLES.medium;

  return (
    <div className={cn("rounded-2xl border-2 p-4 space-y-3", st.ring, st.bg)}>
      <div className="flex items-start gap-3">
        {/* Priority number */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-fg text-bg text-sm font-black">
          {priority}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold leading-tight">Задание {group.task_number}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", st.badge)}>
              {st.label}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5 leading-tight">{group.title}</p>
        </div>
      </div>

      {/* AI reasoning */}
      <p className="text-sm text-fg/80 leading-relaxed">{group.why}</p>

      {/* Mastery bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-muted">
          <span>Освоение</span>
          <span>{group.mastery_pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-700",
              group.status === "strong" ? "bg-success" : group.status === "weak" ? "bg-danger" : "bg-accent"
            )}
            style={{ width: `${group.mastery_pct}%` }}
          />
        </div>
      </div>

      <button
        onClick={onStart}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-fg text-bg py-2.5 text-sm font-semibold hover:opacity-90 transition"
      >
        Начать
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function StudyPlanTab({ onStartTask }: { onStartTask: (taskNumber: number) => void }) {
  const { data: me } = useMe();
  const { data: planData, isLoading } = useStudyPlan();
  const generate = useGeneratePlan();

  const hasDiagnostic = !!me?.diagnostic_completed_at;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Загружаем план...</p>
      </div>
    );
  }

  if (!hasDiagnostic) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 px-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-fg/8">
          <ClipboardList className="h-10 w-10 text-muted" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Сначала диагностика</h2>
          <p className="text-sm text-muted leading-relaxed">
            Чтобы составить персональный план, AI-репетитору нужно знать твой уровень. Пройди входную диагностику — это займёт 15–20 минут.
          </p>
        </div>
        <Link
          href="/diagnostic"
          className="flex items-center gap-2 rounded-2xl bg-fg text-bg px-6 py-3.5 text-sm font-bold hover:opacity-90 transition"
        >
          <ClipboardList className="h-4 w-4" />
          Пройти диагностику
        </Link>
      </div>
    );
  }

  if (!planData?.plan) {
    return (
      <div className="flex flex-col items-center gap-6 py-12 px-4 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/10">
          <Brain className="h-10 w-10 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold mb-2">Персональный план</h2>
          <p className="text-sm text-muted leading-relaxed">
            AI-репетитор проанализирует результаты диагностики и составит оптимальный порядок подготовки — что учить первым, что можно отложить.
          </p>
        </div>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="flex items-center gap-2 rounded-2xl bg-fg text-bg px-6 py-3.5 text-sm font-bold hover:opacity-90 transition disabled:opacity-50"
        >
          {generate.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Составляем план...</>
          ) : (
            <><Brain className="h-4 w-4" />Составить план</>
          )}
        </button>
        {generate.isError && (
          <p className="text-xs text-danger">Не удалось составить план. Попробуй ещё раз.</p>
        )}
      </div>
    );
  }

  const plan = planData.plan;
  const generatedDate = new Date(plan.generated_at).toLocaleDateString("ru-RU", {
    day: "numeric", month: "long",
  });

  return (
    <div className="space-y-5">
      {/* Summary card */}
      <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent shrink-0" />
          <span className="text-xs font-semibold text-accent uppercase tracking-wide">Вывод AI-репетитора</span>
        </div>
        <p className="text-sm text-fg/90 leading-relaxed">{plan.summary}</p>
      </div>

      {/* Plan groups */}
      <div className="space-y-3">
        {plan.groups.map((group, i) => (
          <PlanGroupCard
            key={group.task_number}
            group={group}
            priority={i + 1}
            onStart={() => onStartTask(group.task_number)}
          />
        ))}
      </div>

      {/* Refresh */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-[11px] text-muted">Составлен {generatedDate}</p>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-fg transition disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3 w-3", generate.isPending && "animate-spin")} />
          Обновить
        </button>
      </div>
    </div>
  );
}

export default function SessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isUnlocked = searchParams.get("unlocked") === "1";
  const tokens = useAuth((s) => s.tokens);
  const { data: me } = useMe();
  const { data: path, isLoading } = useSessionPath();

  const isOge = me?.grade != null && me.grade <= 9;
  const examLabel = isOge ? "ОГЭ · Математика" : "ЕГЭ · Профильная математика";
  const taskRangeLabel = isOge ? "Задания 6–19" : "Задания 1–12";
  const [loadingNode, setLoadingNode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("path");

  const sections = path?.sections ?? [];
  const allNodes = sections.flatMap((s) => s.nodes);
  const completedCount = allNodes.filter((n) => n.state === "completed").length;

  async function handleNodeTap(node: PathNode) {
    if (!tokens) return;
    setLoadingNode(node.topic_id);
    try {
      const { data: session } = await api.get<SubtopicSession>(
        `/tasks/subtopic-session?topic_id=${node.topic_id}&count=5`,
      );
      const [first, ...rest] = session.tasks;
      const allIds = session.tasks.map((t) => t.id);
      const params = new URLSearchParams();
      if (rest.length > 0) params.set("queue", rest.map((t) => t.id).join(","));
      params.set("total", String(allIds.length));
      params.set("all", allIds.join(","));
      router.push(`/task/${first.id}?${params.toString()}`);
    } catch {
      setLoadingNode(null);
    }
  }

  async function handleStartTask(taskNumber: number) {
    if (!tokens) return;
    // Find the first non-completed (or first) node for this task number
    const section = sections.find((s) => s.task_number === taskNumber);
    const node = section?.nodes.find((n) => n.state !== "completed") ?? section?.nodes[0];
    if (node) {
      handleNodeTap(node);
    }
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-md px-6 py-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link href="/today" className="text-muted transition hover:text-fg">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs text-muted">{examLabel}</p>
            <h1 className="text-xl font-bold">{taskRangeLabel}</h1>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mb-6 flex items-center gap-4 text-sm text-muted">
          {isLoading ? (
            <span className="h-4 w-36 animate-pulse rounded bg-fg/10" />
          ) : allNodes.length > 0 ? (
            <>
              <span>
                <span className="font-semibold text-fg">{completedCount}</span>
                {" / "}
                <span className="font-semibold text-fg">{allNodes.length}</span> подтем
              </span>
              {completedCount === allNodes.length && (
                <span className="text-success font-medium">Все темы пройдены ✓</span>
              )}
            </>
          ) : (
            <span className="text-muted">Загрузка...</span>
          )}
        </div>

        {/* Tabs */}
        <div className="flex rounded-2xl bg-fg/5 p-1 mb-8 gap-1">
          {(["path", "plan"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition",
                activeTab === tab
                  ? "bg-bg text-fg shadow-sm"
                  : "text-muted hover:text-fg",
              )}
            >
              {tab === "path" ? (
                <><Zap className="h-3.5 w-3.5" />Путь</>
              ) : (
                <><Brain className="h-3.5 w-3.5" />Мой план</>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "path" ? (
          <div className="flex flex-col gap-10">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-4">
                    <div className="h-16 rounded-2xl animate-pulse bg-fg/10" />
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} className="flex flex-col items-center">
                        <div className="h-[72px] w-[72px] rounded-full bg-fg/10 animate-pulse" />
                        {j < 2 && <div className="my-1 h-16 w-0.5 bg-border/40" />}
                      </div>
                    ))}
                  </div>
                ))
              : sections.map((section) => (
                  <div key={section.task_number} className="flex flex-col items-center gap-0">
                    <SectionHeader section={section} />

                    <div className="mt-6 flex flex-col items-center w-full">
                      {section.nodes.map((node, i) => {
                        const offset = ZIGZAG_OFFSETS[i % ZIGZAG_OFFSETS.length];
                        const nextOffset = ZIGZAG_OFFSETS[(i + 1) % ZIGZAG_OFFSETS.length];
                        const isLast = i === section.nodes.length - 1;
                        return (
                          <div key={node.topic_id} className="flex flex-col items-center w-full">
                            <PathNodeItem
                              node={isUnlocked ? { ...node, state: node.state === "locked" ? "current" : node.state } : node}
                              offset={offset}
                              onTap={handleNodeTap}
                              loading={loadingNode === node.topic_id}
                            />
                            {!isLast && (
                              <Connector fromOffset={offset} toOffset={nextOffset} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

            {!isLoading && sections.length > 0 && (
              <div className="flex flex-col items-center gap-2 opacity-40">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <Star key={i} className="h-5 w-5 text-accent" />
                  ))}
                </div>
                <p className="text-xs text-muted">Финиш</p>
              </div>
            )}
          </div>
        ) : (
          <StudyPlanTab onStartTask={handleStartTask} />
        )}
      </main>
    </>
  );
}
