"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, ChevronLeft, SkipForward, Sparkles, Zap } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { MathText } from "@/components/math-text";
import { Button } from "@/components/ui/button";
import { useSessionPath, useTask } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { getBooster, removeFromBooster, updateBoosterReason, type BoosterItem } from "@/lib/booster";
import { addToKB } from "@/lib/knowledge-base";
import { cn } from "@/lib/utils";
import type { AnswerResult } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

const SECTION_COLORS: Record<number, { header: string; badge: string }> = {
  1: { header: "border-success/20 bg-success/5", badge: "bg-success/20 text-success" },
  2: { header: "border-accent/20 bg-accent/5",   badge: "bg-accent/20 text-accent" },
  3: { header: "border-danger/20 bg-danger/5",   badge: "bg-danger/20 text-danger" },
};

type Phase = "question" | "submitting" | "correct" | "wrong" | "dialogue" | "giveup";
type Message = { role: "user" | "assistant"; content: string };
type TheoryRef = { title: string; section_id: string };

function InlineTaskSolver({
  item,
  onSolved,
  onNext,
}: {
  item: BoosterItem;
  onSolved: () => void;
  onNext: () => void;
}) {
  const { data: task, isLoading } = useTask(item.taskId);
  const tokens = useAuth((s) => s.tokens);

  const [phase, setPhase] = useState<Phase>("question");
  const [answer, setAnswer] = useState("");
  const [wrongAnswer, setWrongAnswer] = useState("");
  const [dialogueId, setDialogueId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [theoryRef, setTheoryRef] = useState<TheoryRef | null>(null);
  const [giveUpResult, setGiveUpResult] = useState<{ correct_answer: string } | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [reply, setReply] = useState("");
  const streamBuffer = useRef("");

  async function startStream(dId: string) {
    if (!tokens) return;
    setStreaming(true);
    streamBuffer.current = "";
    setStreamingText("");
    try {
      const res = await fetch(`${API_URL}/dialogue/${dId}/stream`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (!res.ok) { setStreaming(false); return; }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split(/\r\n\r\n|\n\n/);
        buf = parts.pop() ?? "";
        for (const block of parts) {
          const evName = block.match(/^event: (.+)$/m)?.[1]?.trim();
          const dataStr = block.match(/^data: (.*)$/m)?.[1]?.trim() ?? "";
          if (evName === "token") {
            streamBuffer.current += JSON.parse(dataStr) as string;
            setStreamingText(streamBuffer.current);
          } else if (evName === "meta") {
            const meta = JSON.parse(dataStr) as { theory_ref: TheoryRef | null };
            if (meta.theory_ref) setTheoryRef(meta.theory_ref);
          } else if (evName === "done") {
            const finalText = streamBuffer.current;
            streamBuffer.current = "";
            setStreamingText("");
            setMessages((prev) => [...prev, { role: "assistant", content: finalText }]);
            setStreaming(false);
          } else if (evName === "error") {
            setStreaming(false);
          }
        }
      }
    } catch {
      setStreaming(false);
    }
  }

  async function submitAnswer() {
    if (!answer.trim() || !task) return;
    setPhase("submitting");
    try {
      const { data } = await api.post<AnswerResult>(`/tasks/${task.id}/answer`, { answer: answer.trim() });
      if (data.correct) {
        setPhase("correct");
        removeFromBooster(item.taskId);
        addToKB(item.taskId, item.topicId);
      } else if (data.dialogue_id) {
        setDialogueId(data.dialogue_id);
        setPhase("wrong");
        setWrongAnswer(answer.trim());
      } else {
        setPhase("question");
      }
    } catch {
      setPhase("question");
    }
  }

  function startDialogue() {
    if (!dialogueId) return;
    setPhase("dialogue");
    startStream(dialogueId);
  }

  async function sendReply() {
    if (!reply.trim() || !dialogueId || streaming) return;
    const text = reply.trim();
    setReply("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    await api.post(`/dialogue/${dialogueId}/reply`, { text });
    await startStream(dialogueId);
  }

  async function giveUp() {
    if (!dialogueId) return;
    const { data } = await api.post<{ correct_answer: string }>(`/dialogue/${dialogueId}/give-up`);
    setGiveUpResult(data);
    setPhase("giveup");
    updateBoosterReason(item.taskId, "ai");
    await startStream(dialogueId);
  }

  const assistantTurns = messages.filter((m) => m.role === "assistant").length;
  const canGoNext = !streaming && (phase === "correct" || phase === "giveup" || (phase === "dialogue" && assistantTurns >= 3));

  if (isLoading || !task) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="h-6 w-40 rounded-xl bg-fg/8 animate-pulse" />
        <div className="h-40 rounded-2xl bg-fg/8 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Reason badge */}
      <div>
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
            className="max-h-52 w-auto rounded-xl object-contain"
          />
        )}
      </div>

      {/* Answer input */}
      {(phase === "question" || phase === "submitting" || phase === "wrong") && (
        <div className="space-y-2">
          {phase === "wrong" && answer === wrongAnswer && (
            <div className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger">
              Ответ <span className="font-semibold">{wrongAnswer}</span> — неверно. Попробуй ещё раз.
            </div>
          )}
          <div className="flex gap-2">
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
              placeholder="Введи ответ..."
              disabled={phase === "submitting"}
              className="flex-1 rounded-2xl border border-border bg-transparent px-4 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
            />
            <Button size="lg" onClick={submitAnswer} disabled={!answer.trim() || phase === "submitting"} className="shrink-0">
              {phase === "submitting" ? "..." : "Проверить"}
            </Button>
          </div>
        </div>
      )}

      {/* AI tutor section */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/20 shrink-0">
            <Sparkles className="h-4 w-4 text-accent" />
          </div>
          <span className="text-sm font-semibold">AI-репетитор</span>
        </div>

        <div className="p-4 space-y-3">
          {(phase === "question" || phase === "submitting") && (
            <p className="text-sm text-muted leading-relaxed">
              Попробуй решить задачу самостоятельно. Если ошибёшься — разберём вместе.
            </p>
          )}

          {phase === "wrong" && (
            <>
              <p className="text-sm text-muted leading-relaxed">
                Можем разобрать вместе — я задам наводящие вопросы.
              </p>
              <button
                onClick={startDialogue}
                className="rounded-full bg-fg text-bg px-4 py-2 text-sm font-semibold hover:opacity-90 transition"
              >
                Помоги разобрать
              </button>
            </>
          )}

          {phase === "correct" && (
            <>
              <p className="text-sm font-medium text-success">Правильно! Задание убрано из бустера.</p>
              <button
                onClick={onSolved}
                className="rounded-full bg-success/20 text-success px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition"
              >
                Следующее →
              </button>
            </>
          )}

          {(phase === "dialogue" || phase === "giveup") && (
            <>
              {phase === "giveup" && giveUpResult && (
                <div className="rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-sm">
                  Правильный ответ:{" "}
                  <span className="font-semibold text-success">{giveUpResult.correct_answer}</span>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "assistant" ? "bg-accent/10 border border-accent/15" : "bg-fg/5 ml-8",
                  )}
                >
                  <MathText text={msg.content} />
                </div>
              ))}

              {streaming && (
                <div className="rounded-xl px-4 py-3 text-sm leading-relaxed bg-accent/10 border border-accent/15">
                  {streamingText ? (
                    <><MathText text={streamingText} /><span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-fg/60" /></>
                  ) : (
                    <span className="text-muted">AI думает...</span>
                  )}
                </div>
              )}

              {theoryRef && (
                <div className="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm">
                  <BookOpen className="h-4 w-4 shrink-0 text-muted" />
                  <span className="text-muted">Теория:</span>
                  <span className="font-medium">{theoryRef.title}</span>
                </div>
              )}

              {!streaming && messages.length > 0 && (
                <div className="flex gap-2">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply()}
                    placeholder="Напиши ответ..."
                    className="flex-1 rounded-xl border border-border bg-transparent px-3 py-2.5 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                  />
                  <Button onClick={sendReply} disabled={!reply.trim()}>→</Button>
                </div>
              )}

              {!streaming && (
                <div className="flex flex-wrap gap-2">
                  {phase === "dialogue" && (
                    <button onClick={giveUp} className="rounded-full border border-border px-4 py-2 text-sm text-muted hover:bg-fg/5 transition">
                      Объяснить сразу
                    </button>
                  )}
                  {canGoNext && (
                    <button onClick={onNext} className="rounded-full bg-fg text-bg px-5 py-2 text-sm font-semibold hover:opacity-90 transition">
                      Следующее →
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
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

  function handleSolved() {
    const idx = items.findIndex((i) => i.taskId === selectedId);
    removeFromBooster(selectedId!);
    setItems((prev) => {
      const next = prev.filter((i) => i.taskId !== selectedId);
      const nextItem = next[idx] ?? next[idx - 1] ?? next[0] ?? null;
      setSelectedId(nextItem?.taskId ?? null);
      return next;
    });
  }

  function handleNext() {
    const idx = items.findIndex((i) => i.taskId === selectedId);
    const nextItem = items[idx + 1] ?? items[idx - 1] ?? items[0] ?? null;
    if (nextItem && nextItem.taskId !== selectedId) {
      setSelectedId(nextItem.taskId);
    }
    // refresh list to reflect updated reason tag
    setItems(getBooster());
  }

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

            {/* Left — inline task solver */}
            <main className="flex-1 overflow-y-auto">
              {selectedItem ? (
                <InlineTaskSolver key={selectedItem.taskId} item={selectedItem} onSolved={handleSolved} onNext={handleNext} />
              ) : (
                <div className="flex items-center justify-center h-full text-muted text-sm">
                  Выбери задание справа
                </div>
              )}
            </main>

            {/* Right sidebar — task list */}
            <aside className="w-56 shrink-0 overflow-y-auto border-l border-border bg-bg">
              {grouped.map((taskGroup) => {
                const colors = SECTION_COLORS[taskGroup.difficulty] ?? SECTION_COLORS[2];
                return (
                  <div key={taskGroup.taskNumber}>
                    <div className={cn("flex items-center gap-2 px-3 py-2 sticky top-0 z-10 border-b border-border/50", colors.header)}>
                      <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold shrink-0", colors.badge)}>
                        {taskGroup.taskNumber || "?"}
                      </span>
                      <span className="text-xs font-semibold truncate">Задание {taskGroup.taskNumber}</span>
                    </div>

                    {Array.from(taskGroup.subtopics.entries()).map(([topicId, subGroup]) => (
                      <div key={topicId}>
                        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-muted uppercase tracking-wide leading-tight">
                          {subGroup.subtopicNumber} · {subGroup.subtopicTitle}
                        </p>
                        {subGroup.items.map((item, idx) => {
                          const isSelected = item.taskId === selectedId;
                          return (
                            <button
                              key={item.taskId}
                              onClick={() => {
                                if (window.innerWidth < 768) {
                                  router.push(`/task/${item.taskId}?booster=1`);
                                } else {
                                  setSelectedId(item.taskId);
                                }
                              }}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-2 text-left transition border-b border-border/20 last:border-0",
                                isSelected ? "bg-fg/8" : "hover:bg-fg/5",
                              )}
                            >
                              <span className="text-xs text-muted/60 w-4 shrink-0">{idx + 1}</span>
                              {item.reason === "skipped" ? (
                                <span className="flex items-center gap-1 text-xs text-danger">
                                  <SkipForward className="h-3 w-3 shrink-0" /> Пропущено
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-accent">
                                  <Sparkles className="h-3 w-3 shrink-0" /> С AI
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

          </div>
        )}

      </div>
    </>
  );
}
