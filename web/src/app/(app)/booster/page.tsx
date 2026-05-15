"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, SkipForward, Sparkles, Zap } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { useSessionPath } from "@/lib/queries";
import { getBooster, removeFromBooster, type BoosterItem } from "@/lib/booster";
import { cn } from "@/lib/utils";

const SECTION_COLORS: Record<number, { header: string; badge: string }> = {
  1: { header: "border-success/30 bg-success/5", badge: "bg-success/20 text-success" },
  2: { header: "border-accent/30 bg-accent/5",   badge: "bg-accent/20 text-accent" },
  3: { header: "border-danger/30 bg-danger/5",   badge: "bg-danger/20 text-danger" },
};

function ReasonBadge({ reason }: { reason: BoosterItem["reason"] }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium shrink-0",
        reason === "skipped" ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent",
      )}
    >
      {reason === "skipped" ? (
        <><SkipForward className="h-3 w-3" />Пропущено</>
      ) : (
        <><Sparkles className="h-3 w-3" />С помощью AI</>
      )}
    </span>
  );
}

function TaskRow({
  item,
  onRemove,
}: {
  item: BoosterItem;
  onRemove: () => void;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0 space-y-1">
        <ReasonBadge reason={item.reason} />
        {item.questionPreview && (
          <p className="text-sm text-muted leading-snug line-clamp-1">{item.questionPreview}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => router.push(`/task/${item.taskId}?booster=1`)}
          className="rounded-lg bg-fg text-bg px-3 py-1.5 text-xs font-semibold hover:opacity-90 transition"
        >
          Разобрать
        </button>
        <button
          onClick={onRemove}
          className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:bg-fg/5 transition"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default function BoosterPage() {
  const [items, setItems] = useState<BoosterItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { data: path } = useSessionPath();

  useEffect(() => {
    setItems(getBooster());
    setLoaded(true);
  }, []);

  function remove(taskId: string) {
    removeFromBooster(taskId);
    setItems((prev) => prev.filter((i) => i.taskId !== taskId));
  }

  // Build topic_id → { taskNumber, difficulty, subtopicNumber, subtopicTitle } map
  const topicMeta = useMemo(() => {
    const map = new Map<
      string,
      { taskNumber: number; difficulty: number; subtopicNumber: string; subtopicTitle: string }
    >();
    path?.sections.forEach((section) => {
      section.nodes.forEach((node) => {
        map.set(String(node.topic_id), {
          taskNumber: section.task_number,
          difficulty: section.difficulty,
          subtopicNumber: node.subtopic_number,
          subtopicTitle: node.title,
        });
      });
    });
    return map;
  }, [path]);

  // Group: taskNumber → subtopicId → items[]
  const grouped = useMemo(() => {
    type SubGroup = { subtopicNumber: string; subtopicTitle: string; items: BoosterItem[] };
    type TaskGroup = { taskNumber: number; difficulty: number; subtopics: Map<string, SubGroup> };
    const byTask = new Map<number, TaskGroup>();

    items.forEach((item) => {
      const meta = topicMeta.get(item.topicId);
      const taskNum = meta?.taskNumber ?? 0;
      const difficulty = meta?.difficulty ?? 2;
      const subtopicNumber = meta?.subtopicNumber ?? "—";
      const subtopicTitle = meta?.subtopicTitle ?? "Неизвестный подтип";

      if (!byTask.has(taskNum)) {
        byTask.set(taskNum, { taskNumber: taskNum, difficulty, subtopics: new Map() });
      }
      const taskGroup = byTask.get(taskNum)!;
      if (!taskGroup.subtopics.has(item.topicId)) {
        taskGroup.subtopics.set(item.topicId, { subtopicNumber, subtopicTitle, items: [] });
      }
      taskGroup.subtopics.get(item.topicId)!.items.push(item);
    });

    return Array.from(byTask.values()).sort((a, b) => a.taskNumber - b.taskNumber);
  }, [items, topicMeta]);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-md px-6 py-10 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/today" className="text-muted hover:text-fg transition">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-accent" />
              Бустер
            </h1>
            <p className="text-sm text-muted">
              {loaded && items.length > 0 ? `${items.length} заданий для отработки` : "Задания для повторной отработки"}
            </p>
          </div>
        </div>

        {/* Loading */}
        {!loaded && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 rounded-2xl animate-pulse bg-fg/5" />
            ))}
          </div>
        )}

        {/* Empty */}
        {loaded && items.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
              <Zap className="h-8 w-8 text-success" />
            </div>
            <p className="text-lg font-semibold">Всё отработано!</p>
            <p className="text-sm text-muted">
              Здесь появятся задания, которые ты пропустил или решил с помощью AI.
            </p>
            <Link
              href="/session"
              className="mt-2 rounded-full bg-fg text-bg px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition"
            >
              Продолжить учёбу →
            </Link>
          </div>
        )}

        {/* Grouped list */}
        {loaded && grouped.map((taskGroup) => {
          const colors = SECTION_COLORS[taskGroup.difficulty] ?? SECTION_COLORS[2];
          const totalInGroup = Array.from(taskGroup.subtopics.values()).reduce(
            (s, sg) => s + sg.items.length, 0,
          );

          return (
            <div key={taskGroup.taskNumber} className="rounded-2xl border border-border overflow-hidden">
              {/* Task header */}
              <div className={cn("flex items-center gap-3 px-4 py-3 border-b border-border/50", colors.header)}>
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", colors.badge)}>
                  {taskGroup.taskNumber || "?"}
                </div>
                <span className="flex-1 text-sm font-semibold">
                  {taskGroup.taskNumber ? `Задание ${taskGroup.taskNumber}` : "Прочее"}
                </span>
                <span className="text-xs text-muted">{totalInGroup} шт</span>
              </div>

              {/* Subtopics */}
              <div className="divide-y divide-border/50">
                {Array.from(taskGroup.subtopics.entries()).map(([topicId, subGroup]) => (
                  <div key={topicId} className="px-4 py-3">
                    <p className="text-xs font-semibold text-muted mb-1">
                      {subGroup.subtopicNumber} · {subGroup.subtopicTitle}
                    </p>
                    {subGroup.items.map((item) => (
                      <TaskRow key={item.taskId} item={item} onRemove={() => remove(item.taskId)} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </main>
    </>
  );
}
