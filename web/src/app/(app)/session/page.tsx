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
import type { PathNode, Task } from "@/lib/types";

const ZIGZAG_OFFSETS = [56, 16, -56, -16, 56, 16, -56, -16];

type NodeState = "completed" | "current" | "locked";

function PathNode({
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

  const nodes = path?.nodes ?? [];
  const completedCount = nodes.filter((n) => n.state === "completed").length;

  async function handleNodeTap(node: PathNode) {
    if (!tokens) return;
    setLoadingNode(node.topic_id);
    try {
      const { data: task } = await api.get<Task>(
        `/tasks/random-by-topic?topic_id=${node.topic_id}`,
      );
      router.push(`/task/${task.id}`);
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
            <p className="text-xs text-muted">ЕГЭ · Математика (Профильная)</p>
            <h1 className="text-xl font-bold">Задание 1 — Планиметрия</h1>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mb-10 flex items-center gap-4 text-sm text-muted">
          {isLoading ? (
            <span className="h-4 w-36 animate-pulse rounded bg-fg/10" />
          ) : nodes.length > 0 ? (
            <>
              <span>
                <span className="font-semibold text-fg">{completedCount}</span>
                {" / "}
                <span className="font-semibold text-fg">{nodes.length}</span> тем
              </span>
              {completedCount === nodes.length && (
                <span className="text-success font-medium">Все темы пройдены ✓</span>
              )}
            </>
          ) : (
            <span className="text-muted">Загрузка...</span>
          )}
        </div>

        {/* Path */}
        <div className="flex flex-col items-center">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="h-[72px] w-[72px] rounded-full bg-fg/10 animate-pulse" />
                  {i < 4 && <div className="my-1 h-16 w-0.5 bg-border/40" />}
                </div>
              ))
            : nodes.map((node, i) => {
                const offset = ZIGZAG_OFFSETS[i % ZIGZAG_OFFSETS.length];
                const nextOffset = ZIGZAG_OFFSETS[(i + 1) % ZIGZAG_OFFSETS.length];
                const isLast = i === nodes.length - 1;

                return (
                  <div key={node.topic_id} className="flex flex-col items-center w-full">
                    <PathNode
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

          {!isLoading && nodes.length > 0 && (
            <div className="mt-6 flex flex-col items-center gap-2 opacity-40">
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
