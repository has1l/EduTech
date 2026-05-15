"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, SkipForward, Sparkles, Zap } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { MathText } from "@/components/math-text";
import { useSessionPath, useTask } from "@/lib/queries";
import { getBooster, removeFromBooster, type BoosterItem } from "@/lib/booster";
import { cn } from "@/lib/utils";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

const SECTION_COLORS: Record<number, { header: string; badge: string }> = {
  1: { header: "border-success/20 bg-success/5", badge: "bg-success/20 text-success" },
  2: { header: "border-accent/20 bg-accent/5",   badge: "bg-accent/20 text-accent" },
  3: { header: "border-danger/20 bg-danger/5",   badge: "bg-danger/20 text-danger" },
};

// Right panel: shows selected task
function TaskPanel({ item, onRemove }: { item: BoosterItem; onRemove: () => void }) {
  const router = useRouter();
  const { data: task, isLoading } = useTask(item.taskId);

  if (isLoading || !task) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="h-6 w-40 rounded-xl bg-fg/8 animate-pulse" />
        <div className="h-40 rounded-2xl bg-fg/8 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Reason badge */}
      <div className="flex items-center gap-2">
        {item.reason === "skipped" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-danger/10 px-3 py-1 text-sm font-medium text-danger">
            <SkipForward className="h-3.5 w-3.5" /> Пропущено
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
            <Sparkles className="h-3.5 w-3.5" /> Решено с AI
          </span>
        )}
      </div>

      {/* Task content */}
      <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
        {task.question_text &&
          !(task.question_image_url &&
            (task.question_text.endsWith("...") || task.question_text.endsWith("…"))) && (
          <p className="text-base leading-relaxed whitespace-pre-wrap">
            <MathText text={task.question_text} />
          </p>
        )}
        {task.question_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              task.question_image_url.startsWith("data:") ||
              task.question_image_url.startsWith("https://storage.yandexcloud.net")
                ? task.question_image_url
                : `${API_URL}/tasks/image-proxy?url=${encodeURIComponent(task.question_image_url)}`
            }
            alt="Рисунок к задаче"
            className="w-full rounded-xl"
          />
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => router.push(`/task/${item.taskId}?booster=1`)}
          className="flex-1 rounded-xl bg-fg text-bg py-3 text-sm font-semibold hover:opacity-90 transition"
        >
          Разобрать →
        </button>
        <button
          onClick={onRemove}
          className="rounded-xl border border-border px-4 py-3 text-sm text-muted hover:bg-fg/5 transition"
        >
          Удалить
        </button>
      </div>
    </div>
  );
}

export default function BoosterPage() {
  const router = useRouter();
  const [items, setItems] = useState<BoosterItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: path } = useSessionPath();

  useEffect(() => {
    const stored = getBooster();
    setItems(stored);
    if (stored.length > 0) setSelectedId(stored[0].taskId);
    setLoaded(true);
  }, []);

  function remove(taskId: string) {
    removeFromBooster(taskId);
    setItems((prev) => {
      const next = prev.filter((i) => i.taskId !== taskId);
      if (selectedId === taskId) setSelectedId(next[0]?.taskId ?? null);
      return next;
    });
  }

  // topic_id → { taskNumber, difficulty, subtopicNumber, subtopicTitle }
  const topicMeta = useMemo(() => {
    const map = new Map<string, { taskNumber: number; difficulty: number; subtopicNumber: string; subtopicTitle: string }>();
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
      if (!byTask.has(taskNum)) {
        byTask.set(taskNum, { taskNumber: taskNum, difficulty: meta?.difficulty ?? 2, subtopics: new Map() });
      }
      const taskGroup = byTask.get(taskNum)!;
      if (!taskGroup.subtopics.has(item.topicId)) {
        taskGroup.subtopics.set(item.topicId, {
          subtopicNumber: meta?.subtopicNumber ?? "—",
          subtopicTitle: meta?.subtopicTitle ?? "Неизвестный подтип",
          items: [],
        });
      }
      taskGroup.subtopics.get(item.topicId)!.items.push(item);
    });

    return Array.from(byTask.values()).sort((a, b) => a.taskNumber - b.taskNumber);
  }, [items, topicMeta]);

  const selectedItem = items.find((i) => i.taskId === selectedId) ?? null;

  return (
    <>
      <AppNav />
      <div className="flex flex-col h-[calc(100vh-3.5rem)]">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border shrink-0">
          <Link href="/today" className="text-muted hover:text-fg transition">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Zap className="h-5 w-5 text-accent" />
          <div className="flex-1">
            <h1 className="text-lg font-bold leading-tight">Бустер</h1>
            {loaded && (
              <p className="text-xs text-muted">
                {items.length > 0 ? `${items.length} заданий для отработки` : "Все задания отработаны"}
              </p>
            )}
          </div>
        </div>

        {/* Empty */}
        {loaded && items.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-center px-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
              <Zap className="h-8 w-8 text-success" />
            </div>
            <p className="text-lg font-semibold">Всё отработано!</p>
            <p className="text-sm text-muted">Здесь появятся задания, которые ты пропустил или решил с помощью AI.</p>
            <Link href="/session" className="mt-2 rounded-full bg-fg text-bg px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition">
              Продолжить учёбу →
            </Link>
          </div>
        )}

        {/* Split layout */}
        {loaded && items.length > 0 && (
          <div className="flex flex-1 overflow-hidden">

            {/* Left sidebar — task list */}
            <aside className="w-64 shrink-0 overflow-y-auto border-r border-border">
              {grouped.map((taskGroup) => {
                const colors = SECTION_COLORS[taskGroup.difficulty] ?? SECTION_COLORS[2];
                return (
                  <div key={taskGroup.taskNumber}>
                    {/* Task section header */}
                    <div className={cn("flex items-center gap-2 px-3 py-2 sticky top-0 border-b border-border/50", colors.header)}>
                      <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold", colors.badge)}>
                        {taskGroup.taskNumber || "?"}
                      </span>
                      <span className="text-xs font-semibold">Задание {taskGroup.taskNumber}</span>
                    </div>

                    {/* Subtopics */}
                    {Array.from(taskGroup.subtopics.entries()).map(([topicId, subGroup]) => (
                      <div key={topicId}>
                        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted uppercase tracking-wide">
                          {subGroup.subtopicNumber} · {subGroup.subtopicTitle}
                        </p>
                        {subGroup.items.map((item, idx) => {
                          const isSelected = item.taskId === selectedId;
                          return (
                            <button
                              key={item.taskId}
                              onClick={() => {
                                // mobile: navigate directly; desktop: show in panel
                                if (window.innerWidth < 768) {
                                  router.push(`/task/${item.taskId}?booster=1`);
                                } else {
                                  setSelectedId(item.taskId);
                                }
                              }}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-2.5 text-left transition border-b border-border/30 last:border-0",
                                isSelected ? "bg-fg/8" : "hover:bg-fg/5",
                              )}
                            >
                              <span className="text-xs text-muted w-4 shrink-0">{idx + 1}</span>
                              {item.reason === "skipped" ? (
                                <span className="flex items-center gap-1 text-xs text-danger">
                                  <SkipForward className="h-3 w-3" /> Пропущено
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-accent">
                                  <Sparkles className="h-3 w-3" /> С AI
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                );
              })}
            </aside>

            {/* Right panel — task content */}
            <main className="flex-1 overflow-y-auto">
              {selectedItem ? (
                <TaskPanel item={selectedItem} onRemove={() => remove(selectedItem.taskId)} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted text-sm">
                  Выбери задание слева
                </div>
              )}
            </main>

          </div>
        )}

      </div>
    </>
  );
}
