"use client";

import Link from "next/link";
import { ChevronLeft, Zap, Star, Lock } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { useMe, useTodaySession } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";

// Zigzag offsets from center (px): right → center → left → center → ...
const ZIGZAG_OFFSETS = [56, 16, -56, -16, 56, 16, -56, -16];

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Лёгкое",
  2: "Среднее",
  3: "Сложное",
};

const DIFFICULTY_COLOR: Record<number, string> = {
  1: "text-emerald-500",
  2: "text-yellow-500",
  3: "text-rose-500",
};

type NodeState = "current" | "next" | "locked";

function getNodeState(index: number, total: number): NodeState {
  if (index === 0) return "current";
  if (index <= 1) return "next";
  return "locked";
}

function PathNode({
  task,
  index,
  total,
  offset,
}: {
  task: Task;
  index: number;
  total: number;
  offset: number;
}) {
  const state = getNodeState(index, total);
  const isCurrent = state === "current";
  const isLocked = state === "locked";

  return (
    <div
      className="flex flex-col items-center"
      style={{ transform: `translateX(${offset}px)` }}
    >
      <Link
        href={isLocked ? "#" : `/task/${task.id}`}
        className={cn("group relative block", isLocked && "pointer-events-none")}
        aria-disabled={isLocked}
      >
        {/* Pulse ring for current node */}
        {isCurrent && (
          <span className="absolute inset-0 rounded-full bg-accent/30 animate-ping" />
        )}

        {/* Outer ring */}
        <div
          className={cn(
            "relative flex h-[72px] w-[72px] items-center justify-center rounded-full transition-transform duration-200",
            isCurrent
              ? "bg-accent text-accent-fg shadow-[0_0_0_6px_hsl(var(--accent)/25)] group-hover:scale-105"
              : isLocked
                ? "border-2 border-dashed border-border bg-bg text-muted/40"
                : "border-[3px] border-border bg-bg text-fg/80 group-hover:scale-105 group-hover:border-accent/60",
          )}
        >
          {isCurrent ? (
            <Zap className="h-7 w-7 fill-current" />
          ) : isLocked ? (
            <Lock className="h-5 w-5" />
          ) : (
            <span className="text-xl font-bold">{index + 1}</span>
          )}
        </div>
      </Link>

      {/* Difficulty label */}
      <p
        className={cn(
          "mt-2 text-xs font-medium",
          isLocked ? "text-muted/40" : DIFFICULTY_COLOR[task.difficulty] ?? "text-muted",
        )}
      >
        {DIFFICULTY_LABEL[task.difficulty] ?? `Задание ${index + 1}`}
      </p>
    </div>
  );
}

function Connector({
  fromOffset,
  toOffset,
}: {
  fromOffset: number;
  toOffset: number;
}) {
  const cx = 160; // center of 320px container
  const x1 = cx + fromOffset;
  const x2 = cx + toOffset;
  const height = 64;

  return (
    <svg
      width="320"
      height={height}
      className="overflow-visible"
      style={{ marginLeft: "-50%", transform: "translateX(50%)" }}
    >
      <line
        x1={x1}
        y1={0}
        x2={x2}
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
  const { data: me } = useMe();
  const { data: session, isLoading } = useTodaySession();
  const firstName = me?.name?.split(" ")[0] ?? "ученик";
  const tasks = session?.tasks ?? [];
  const totalMin = tasks.reduce((s, t) => s + t.difficulty * 2, 0);

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
            <p className="text-xs text-muted">ОГЭ · Математика</p>
            <h1 className="text-xl font-bold">Задания на сегодня</h1>
          </div>
        </div>

        {/* Stats bar */}
        <div className="mb-10 flex items-center gap-4 text-sm text-muted">
          {isLoading ? (
            <span className="h-4 w-36 animate-pulse rounded bg-fg/10" />
          ) : tasks.length > 0 ? (
            <>
              <span>
                <span className="font-semibold text-fg">{tasks.length}</span> задания
              </span>
              <span className="text-border">·</span>
              <span>~{totalMin} мин</span>
            </>
          ) : (
            <span className="text-emerald-500 font-medium">Всё сделано сегодня ✓</span>
          )}
        </div>

        {/* Path */}
        <div className="flex flex-col items-center">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="h-[72px] w-[72px] rounded-full bg-fg/10 animate-pulse" />
                  {i < 2 && <div className="my-1 h-16 w-0.5 bg-border/40" />}
                </div>
              ))
            : tasks.map((task, i) => {
                const offset = ZIGZAG_OFFSETS[i % ZIGZAG_OFFSETS.length];
                const nextOffset = ZIGZAG_OFFSETS[(i + 1) % ZIGZAG_OFFSETS.length];
                const isLast = i === tasks.length - 1;

                return (
                  <div key={task.id} className="flex flex-col items-center w-full">
                    <PathNode
                      task={task}
                      index={i}
                      total={tasks.length}
                      offset={offset}
                    />
                    {!isLast && (
                      <Connector fromOffset={offset} toOffset={nextOffset} />
                    )}
                  </div>
                );
              })}

          {/* End marker */}
          {!isLoading && tasks.length > 0 && (
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
