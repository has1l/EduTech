"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Loader2, Star, Zap, Lock, CheckCircle2 } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { useMe, useSessionPath } from "@/lib/queries";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { PathNode, SubtopicSession, TaskSection } from "@/lib/types";

const ZIGZAG_OFFSETS = [56, 16, -56, -16, 56, 16, -56, -16];

type NodeState = "completed" | "current" | "locked";
type Tab = "path" | "plan";

// ─── Knowledge Map (Plan tab) ────────────────────────────────────────────────

const G_CARD_W = 148;
const G_CARD_H = 92;
const G_COL_GAP = 16;
const G_ROW_GAP = 40;
const G_ROW_H = G_CARD_H + G_ROW_GAP;
const G_TOTAL_W = G_CARD_W * 2 + G_COL_GAP;
const G_LEFT_CX = G_CARD_W / 2;
const G_RIGHT_CX = G_CARD_W + G_COL_GAP + G_CARD_W / 2;

interface GNode { task_number: number; title: string; hours: string }

const EGE_LEFT: GNode[] = [
  { task_number: 4,  title: "Вероятность",             hours: "~2 ч" },
  { task_number: 5,  title: "Сложная вероятность",     hours: "~3 ч" },
  { task_number: 7,  title: "Степени и логарифмы",     hours: "~4 ч" },
  { task_number: 6,  title: "Уравнения",               hours: "~3 ч" },
  { task_number: 8,  title: "Производные",             hours: "~4 ч" },
  { task_number: 9,  title: "Задачи на формулы",       hours: "~2 ч" },
  { task_number: 10, title: "Текстовые задачи",        hours: "~4 ч" },
];
const EGE_RIGHT: GNode[] = [
  { task_number: 1,  title: "Планиметрия",             hours: "~3 ч" },
  { task_number: 2,  title: "Векторы",                 hours: "~4 ч" },
  { task_number: 3,  title: "Стереометрия",            hours: "~5 ч" },
  { task_number: 11, title: "Графики функций",         hours: "~3 ч" },
  { task_number: 12, title: "Исследование функции",    hours: "~3 ч" },
];
// cross-track: [leftRow, rightRow] — Производные (left row 4) → Графики (right row 3)
const EGE_CROSS: [number, number][] = [[4, 3]];

const OGE_LEFT: GNode[] = [
  { task_number: 6,  title: "Выражения",               hours: "~2 ч" },
  { task_number: 7,  title: "Степени и корни",         hours: "~2 ч" },
  { task_number: 8,  title: "Уравнения",               hours: "~3 ч" },
  { task_number: 9,  title: "Неравенства",             hours: "~2 ч" },
  { task_number: 10, title: "Функции",                 hours: "~3 ч" },
  { task_number: 13, title: "Прогрессии",              hours: "~2 ч" },
  { task_number: 14, title: "Вероятность",             hours: "~2 ч" },
];
const OGE_RIGHT: GNode[] = [
  { task_number: 11, title: "Планиметрия",             hours: "~4 ч" },
  { task_number: 12, title: "Прикладные задачи",       hours: "~3 ч" },
  { task_number: 15, title: "Задачи ОГЭ",             hours: "~3 ч" },
  { task_number: 16, title: "Геометрия",               hours: "~4 ч" },
  { task_number: 17, title: "Алгебраические задачи",  hours: "~3 ч" },
  { task_number: 18, title: "Геометрические задачи",  hours: "~4 ч" },
  { task_number: 19, title: "Реальный контекст",       hours: "~2 ч" },
];
const OGE_CROSS: [number, number][] = [];

interface GMastery { total: number; completed: number; isCurrent: boolean }

function GraphNodeCard({
  node,
  mastery,
  isCurrent,
  onStart,
}: {
  node: GNode;
  mastery: GMastery | undefined;
  isCurrent: boolean;
  onStart: () => void;
}) {
  const isCompleted = mastery ? mastery.completed >= mastery.total && mastery.total > 0 : false;
  const isStarted   = mastery ? mastery.completed > 0 || mastery.isCurrent : false;
  const isLocked    = !mastery;

  const borderCls = isCompleted ? "border-success"
    : isCurrent    ? "border-accent"
    : isStarted    ? "border-accent/40"
    : "border-border";

  const dotCls = isCompleted ? "bg-success"
    : isCurrent    ? "bg-accent"
    : isStarted    ? "bg-accent/50"
    : "bg-fg/15";

  return (
    <button
      onClick={() => !isLocked && onStart()}
      disabled={isLocked}
      style={{ width: G_CARD_W, height: G_CARD_H }}
      className={cn(
        "relative rounded-2xl border-2 bg-bg p-3 text-left transition-shadow",
        borderCls,
        isLocked ? "opacity-40 cursor-not-allowed" : "hover:shadow-md cursor-pointer",
      )}
    >
      {isCurrent && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-accent text-accent-fg text-[9px] font-black tracking-wider uppercase px-2 py-0.5 whitespace-nowrap">
          Сейчас
        </span>
      )}

      <div className="flex items-center justify-between mb-2">
        <span className="rounded-lg bg-fg/8 text-fg text-[10px] font-bold px-1.5 py-0.5 leading-none">
          №{node.task_number}
        </span>
        <span className={cn("h-2 w-2 rounded-full shrink-0", dotCls)} />
      </div>

      <p className="text-[11px] font-bold leading-tight line-clamp-2 mb-1.5">
        {node.title}
      </p>

      {mastery ? (
        <p className="text-[10px] text-muted tabular-nums">
          {mastery.completed}/{mastery.total} тем
        </p>
      ) : (
        <p className="text-[10px] text-muted">{node.hours}</p>
      )}
    </button>
  );
}

function KnowledgeGraph({
  leftTrack,
  rightTrack,
  crossEdges,
  taskMastery,
  currentTaskNumber,
  onStartTask,
}: {
  leftTrack: GNode[];
  rightTrack: GNode[];
  crossEdges: [number, number][];
  taskMastery: Record<number, GMastery>;
  currentTaskNumber: number | null;
  onStartTask: (n: number) => void;
}) {
  const maxRows = Math.max(leftTrack.length, rightTrack.length);
  const svgH = maxRows * G_ROW_H - G_ROW_GAP + 8;

  const cy = (row: number) => row * G_ROW_H + G_CARD_H / 2;

  return (
    <div className="relative mx-auto" style={{ width: G_TOTAL_W }}>
      <svg
        className="absolute top-0 left-0 pointer-events-none z-10"
        width={G_TOTAL_W}
        height={svgH}
        overflow="visible"
      >
        {/* In-track left lines */}
        {leftTrack.slice(0, -1).map((_, i) => (
          <line
            key={`ll${i}`}
            x1={G_LEFT_CX} y1={i * G_ROW_H + G_CARD_H}
            x2={G_LEFT_CX} y2={(i + 1) * G_ROW_H}
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
            strokeDasharray="4 5"
          />
        ))}

        {/* In-track right lines */}
        {rightTrack.slice(0, -1).map((_, i) => (
          <line
            key={`rl${i}`}
            x1={G_RIGHT_CX} y1={i * G_ROW_H + G_CARD_H}
            x2={G_RIGHT_CX} y2={(i + 1) * G_ROW_H}
            stroke="hsl(var(--border))"
            strokeWidth="1.5"
            strokeDasharray="4 5"
          />
        ))}

        {/* Cross-track "помогает" arrows */}
        {crossEdges.map(([lRow, rRow], i) => (
          <line
            key={`cr${i}`}
            x1={G_CARD_W}      y1={cy(lRow)}
            x2={G_CARD_W + G_COL_GAP} y2={cy(rRow)}
            stroke="hsl(var(--accent))"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.7"
          />
        ))}
      </svg>

      <div className="relative flex gap-[16px]">
        <div className="flex flex-col gap-[40px]">
          {leftTrack.map((node) => (
            <GraphNodeCard
              key={node.task_number}
              node={node}
              mastery={taskMastery[node.task_number]}
              isCurrent={currentTaskNumber === node.task_number}
              onStart={() => onStartTask(node.task_number)}
            />
          ))}
        </div>
        <div className="flex flex-col gap-[40px]">
          {rightTrack.map((node) => (
            <GraphNodeCard
              key={node.task_number}
              node={node}
              mastery={taskMastery[node.task_number]}
              isCurrent={currentTaskNumber === node.task_number}
              onStart={() => onStartTask(node.task_number)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function KnowledgeMapTab({
  sections,
  isLoading,
  isOge,
  onStartTask,
}: {
  sections: TaskSection[];
  isLoading: boolean;
  isOge: boolean;
  onStartTask: (n: number) => void;
}) {
  const taskMastery = useMemo<Record<number, GMastery>>(() => {
    const map: Record<number, GMastery> = {};
    for (const s of sections) {
      map[s.task_number] = {
        total: s.nodes.length,
        completed: s.nodes.filter((n) => n.state === "completed").length,
        isCurrent: s.nodes.some((n) => n.state === "current"),
      };
    }
    return map;
  }, [sections]);

  const leftTrack  = isOge ? OGE_LEFT  : EGE_LEFT;
  const rightTrack = isOge ? OGE_RIGHT : EGE_RIGHT;
  const crossEdges = isOge ? OGE_CROSS : EGE_CROSS;

  const currentTaskNumber = useMemo(() => {
    for (const node of [...leftTrack, ...rightTrack]) {
      if (taskMastery[node.task_number]?.isCurrent) return node.task_number;
    }
    return null;
  }, [taskMastery, leftTrack, rightTrack]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Загружаем карту...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-[11px] font-bold tracking-widest uppercase text-muted mb-1">
          Карта знаний
        </p>
        <p className="text-sm text-fg/70 leading-relaxed">
          Каждая следующая тема опирается на предыдущую.{" "}
          <span className="text-accent font-medium">Жёлтая стрелка</span> — без этого не пойдёт дальше.
        </p>
      </div>

      {/* Track labels */}
      <div className="mx-auto flex gap-[16px]" style={{ width: G_TOTAL_W }}>
        <div className="flex items-center gap-1.5" style={{ width: G_CARD_W }}>
          <span className="h-2 w-2 rounded-full bg-accent shrink-0" />
          <span className="text-[10px] font-black tracking-wider uppercase text-accent">Алгебра</span>
        </div>
        <div className="flex items-center gap-1.5" style={{ width: G_CARD_W }}>
          <span className="h-2 w-2 rounded-full bg-fg shrink-0" />
          <span className="text-[10px] font-black tracking-wider uppercase text-fg">Геометрия</span>
        </div>
      </div>

      {/* Graph */}
      <KnowledgeGraph
        leftTrack={leftTrack}
        rightTrack={rightTrack}
        crossEdges={crossEdges}
        taskMastery={taskMastery}
        currentTaskNumber={currentTaskNumber}
        onStartTask={onStartTask}
      />

      {/* Legend */}
      <div className="mx-auto flex items-center gap-5 pt-2 pb-6" style={{ width: G_TOTAL_W }}>
        <span className="flex items-center gap-1.5 text-[10px] text-muted">
          <svg width="20" height="8">
            <line x1="0" y1="4" x2="20" y2="4" stroke="hsl(var(--border))" strokeWidth="1.5" strokeDasharray="4 4" />
          </svg>
          в треке
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted">
          <svg width="20" height="8">
            <line x1="0" y1="4" x2="20" y2="4" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeDasharray="4 4" />
          </svg>
          помогает
        </span>
      </div>
    </div>
  );
}

// ─── Path section header ──────────────────────────────────────────────────────

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
                <>📍 Мой план</>
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
          <KnowledgeMapTab
            sections={sections}
            isLoading={isLoading}
            isOge={isOge}
            onStartTask={handleStartTask}
          />
        )}
      </main>
    </>
  );
}
