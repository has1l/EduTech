"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Zap, Star, Lock, CheckCircle2 } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { useSessionPath } from "@/lib/queries";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { PathNode, SubtopicSession, TaskSection } from "@/lib/types";

const ZIGZAG_OFFSETS = [56, 16, -56, -16, 56, 16, -56, -16];

type NodeState = "completed" | "current" | "locked";

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

  return (
    <div
      className="flex flex-col items-center"
      style={{ transform: `translateX(${offset}px)` }}
    >
      <button
        onClick={() => !isLocked && !loading && onTap(node)}
        disabled={isLocked || loading}
        className={cn(
          "group relative block rounded-full transition-transform duration-200",
          isLocked ? "cursor-not-allowed" : "cursor-pointer",
        )}
      >
        {isCurrent && (
          <span className="absolute inset-0 rounded-full bg-accent/30 animate-ping" />
        )}
        <div
          className={cn(
            "relative flex h-[72px] w-[72px] items-center justify-center rounded-full transition-transform duration-200",
            isCurrent
              ? "bg-accent text-accent-fg shadow-[0_0_0_6px_hsl(var(--accent)/25)] group-hover:scale-105"
              : isCompleted
                ? "bg-success/20 border-2 border-success text-success group-hover:scale-105"
                : "border-2 border-dashed border-border bg-bg text-muted/40",
          )}
        >
          {isCurrent ? (
            <Zap className="h-7 w-7 fill-current" />
          ) : isCompleted ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            <Lock className="h-5 w-5" />
          )}
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
  const tokens = useAuth((s) => s.tokens);
  const { data: path, isLoading } = useSessionPath();
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
      const queue = rest.map((t) => t.id).join(",");
      const url = queue ? `/task/${first.id}?queue=${queue}` : `/task/${first.id}`;
      router.push(url);
    } catch {
      setLoadingNode(null);
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
            <p className="text-xs text-muted">ЕГЭ · Профильная математика</p>
            <h1 className="text-xl font-bold">Задания 1–12</h1>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mb-10 flex items-center gap-4 text-sm text-muted">
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

        {/* Path — one section at a time */}
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
                            node={node}
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
      </main>
    </>
  );
}
