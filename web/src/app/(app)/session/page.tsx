"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { useMe, useSessionPath } from "@/lib/queries";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { PathNode, SubtopicSession, TaskSection } from "@/lib/types";

const ZIGZAG_OFFSETS = [48, 12, -48, -12, 48, 12, -48, -12];

// Emoji per EGE task number — gives each skill a distinct visual
const TASK_EMOJI: Record<number, string> = {
  1: "🔢", 2: "📏", 3: "📊", 4: "⚡", 5: "📈",
  6: "🔄", 7: "📐", 8: "🎯", 9: "💡", 10: "🧮",
  11: "🔬", 12: "🏆",
};

// Colors per difficulty
const DIFF_COLORS = {
  1: { bg: "bg-success", ring: "ring-success/40", dim: "bg-success/20", text: "text-success", header: "from-success/15 to-success/5 border-success/20" },
  2: { bg: "bg-accent", ring: "ring-accent/40", dim: "bg-accent/20", text: "text-accent", header: "from-accent/15 to-accent/5 border-accent/20" },
  3: { bg: "bg-danger", ring: "ring-danger/40", dim: "bg-danger/20", text: "text-danger", header: "from-danger/15 to-danger/5 border-danger/20" },
} as Record<number, { bg: string; ring: string; dim: string; text: string; header: string }>;

type NodeState = "completed" | "current" | "locked";

// ─── Section header ──────────────────────────────────────────────────────────

function SectionHeader({ section }: { section: TaskSection }) {
  const c = DIFF_COLORS[section.difficulty] ?? DIFF_COLORS[2];
  const completed = section.nodes.filter((n) => n.state === "completed").length;
  const total = section.nodes.length;
  const pct = total > 0 ? (completed / total) * 100 : 0;
  const emoji = TASK_EMOJI[section.task_number] ?? "📚";

  return (
    <div className={cn("rounded-2xl border bg-gradient-to-br px-4 py-3.5 w-full", c.header)}>
      <div className="flex items-center gap-3">
        {/* Round avatar with emoji */}
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl", c.dim)}>
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn("text-xs font-semibold uppercase tracking-wide", c.text)}>
            Задание {section.task_number}
          </p>
          <p className="text-sm font-bold leading-tight truncate text-fg">{section.title}</p>
        </div>
        <span className={cn("text-xs font-bold tabular-nums shrink-0", c.text)}>
          {completed}/{total}
        </span>
      </div>
      {/* Progress bar */}
      <div className="mt-2.5 h-1 rounded-full bg-fg/10 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", c.bg)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─── Stars ───────────────────────────────────────────────────────────────────

function Stars({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M5 1l1.1 2.3L9 3.6 6.9 5.7l.5 2.9L5 7.3 2.6 8.6l.5-2.9L1 3.6l2.9-.3L5 1z"
            fill={i < count ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </div>
  );
}

// ─── Node card ───────────────────────────────────────────────────────────────

function PathNodeItem({
  node,
  offset,
  taskNumber,
  difficulty,
  onTap,
  loading,
}: {
  node: PathNode;
  offset: number;
  taskNumber: number;
  difficulty: number;
  onTap: (node: PathNode) => void;
  loading: boolean;
}) {
  const state = node.state as NodeState;
  const isCurrent = state === "current";
  const isCompleted = state === "completed";
  const isLocked = state === "locked";
  const c = DIFF_COLORS[difficulty] ?? DIFF_COLORS[2];
  const emoji = TASK_EMOJI[taskNumber] ?? "📚";
  const stars = Math.min(node.correct_count, 5);

  return (
    <div
      className="flex flex-col items-center"
      style={{ transform: `translateX(${offset}px)` }}
    >
      <button
        onClick={() => !isLocked && !loading && onTap(node)}
        disabled={isLocked || loading}
        className={cn(
          "group relative transition-all duration-200 active:scale-95",
          isLocked ? "cursor-not-allowed" : "cursor-pointer hover:scale-105",
        )}
      >
        {/* Ping ring for current node */}
        {isCurrent && (
          <span className={cn("absolute inset-0 rounded-[18px] animate-ping opacity-40", c.bg)} />
        )}

        {/* Card body */}
        <div
          className={cn(
            "relative flex flex-col items-center justify-between rounded-[18px] px-2 py-2.5 transition-all duration-200",
            "w-[72px] h-[96px]",
            isCurrent
              ? cn(c.bg, "text-bg shadow-lg", `ring-4 ${c.ring}`)
              : isCompleted
                ? cn(c.dim, c.text, "border border-current/20")
                : "bg-fg/5 border border-dashed border-border text-muted/30",
          )}
        >
          {/* Emoji / skill art */}
          <div className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full text-2xl",
            isCurrent ? "bg-white/20" : isCompleted ? "bg-white/30" : "bg-fg/5",
            isLocked && "opacity-30 grayscale",
          )}>
            {isLocked ? "🔒" : emoji}
          </div>

          {/* Subtopic label */}
          <p className={cn(
            "text-[10px] font-bold tabular-nums leading-tight text-center",
            isCurrent ? "text-bg/90" : isCompleted ? c.text : "text-muted/30",
          )}>
            {node.subtopic_number}
          </p>

          {/* Stars */}
          <div className={cn(
            isCurrent ? "text-bg/80" : isCompleted ? c.text : "text-muted/20",
          )}>
            <Stars count={stars} />
          </div>
        </div>
      </button>

      {/* Title below card */}
      <p
        className={cn(
          "mt-1.5 text-center text-[10px] max-w-[84px] leading-tight px-1",
          isLocked ? "text-muted/30" : isCompleted ? "text-muted" : "text-fg/70",
        )}
      >
        {node.title}
      </p>
    </div>
  );
}

// ─── Connector line ───────────────────────────────────────────────────────────

function Connector({ fromOffset, toOffset, completed }: { fromOffset: number; toOffset: number; completed: boolean }) {
  const cx = 160;
  const height = 56;
  return (
    <svg
      width="320"
      height={height}
      className="overflow-visible shrink-0"
      style={{ marginLeft: "-50%", transform: "translateX(50%)" }}
    >
      <line
        x1={cx + fromOffset}
        y1={0}
        x2={cx + toOffset}
        y2={height}
        stroke={completed ? "hsl(var(--success))" : "hsl(var(--border))"}
        strokeWidth="2"
        strokeDasharray={completed ? "none" : "4 4"}
        strokeLinecap="round"
        opacity={completed ? 0.5 : 0.6}
      />
    </svg>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-md px-6 py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link href="/today" className="text-muted transition hover:text-fg">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs text-muted">{examLabel}</p>
            <h1 className="text-xl font-bold">{taskRangeLabel}</h1>
          </div>
          <div className="ml-auto text-right">
            {!isLoading && allNodes.length > 0 && (
              <>
                <p className="text-lg font-bold">{completedCount}</p>
                <p className="text-[10px] text-muted">из {allNodes.length}</p>
              </>
            )}
          </div>
        </div>

        {/* Path */}
        <div className="mt-8 flex flex-col gap-10">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-6">
                  <div className="h-[72px] rounded-2xl animate-pulse bg-fg/8" />
                  {Array.from({ length: 3 }).map((_, j) => (
                    <div key={j} className="flex flex-col items-center gap-2">
                      <div className="h-[96px] w-[72px] rounded-[18px] bg-fg/8 animate-pulse" />
                    </div>
                  ))}
                </div>
              ))
            : sections.map((section) => (
                <div key={section.task_number} className="flex flex-col items-center gap-0">
                  <SectionHeader section={section} />

                  <div className="mt-5 flex flex-col items-center w-full">
                    {section.nodes.map((node, i) => {
                      const offset = ZIGZAG_OFFSETS[i % ZIGZAG_OFFSETS.length];
                      const nextOffset = ZIGZAG_OFFSETS[(i + 1) % ZIGZAG_OFFSETS.length];
                      const isLast = i === section.nodes.length - 1;
                      const effectiveNode = isUnlocked
                        ? { ...node, state: node.state === "locked" ? "current" : node.state }
                        : node;
                      return (
                        <div key={node.topic_id} className="flex flex-col items-center w-full">
                          <PathNodeItem
                            node={effectiveNode}
                            offset={offset}
                            taskNumber={section.task_number}
                            difficulty={section.difficulty}
                            onTap={handleNodeTap}
                            loading={loadingNode === node.topic_id}
                          />
                          {!isLast && (
                            <Connector
                              fromOffset={offset}
                              toOffset={nextOffset}
                              completed={effectiveNode.state === "completed"}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

          {/* Finish banner */}
          {!isLoading && sections.length > 0 && (
            <div className="flex flex-col items-center gap-3 py-4 opacity-50">
              <div className="text-3xl">🏁</div>
              <p className="text-sm font-semibold text-muted">Конец пути</p>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
