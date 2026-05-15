"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ChevronLeft, Plus, Sparkles } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { MathText } from "@/components/math-text";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTask } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { addToBooster, removeFromBooster } from "@/lib/booster";
import type { AnswerResult, SubtopicSession } from "@/lib/types";

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Лёгкий",
  2: "Средний",
  3: "Сложный",
};

const DIFFICULTY_COLOR: Record<number, string> = {
  1: "bg-success/15 text-success",
  2: "bg-accent/15 text-accent",
  3: "bg-danger/15 text-danger",
};

type Phase = "question" | "submitting" | "correct" | "wrong" | "dialogue" | "giveup";
type Message = { role: "user" | "assistant"; content: string };
type TheoryRef = { title: string; section_id: string };

interface SavedDialogue {
  phase: Phase;
  answer: string;
  dialogueId: string | null;
  messages: Message[];
  theoryRef: TheoryRef | null;
  giveUpResult: { correct_answer: string } | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function dlgKey(taskId: string) {
  return `dlg_${taskId}`;
}

export default function TaskPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokens = useAuth((s) => s.tokens);
  const { data: task, isLoading } = useTask(id);

  // Session navigation params
  const queueParam = searchParams.get("queue") ?? "";
  const queue = queueParam ? queueParam.split(",").filter(Boolean) : [];
  const totalParam = searchParams.get("total");
  const total = totalParam ? parseInt(totalParam) : queue.length + 1;
  const currentPos = total - queue.length;
  const allParam = searchParams.get("all") ?? "";
  const allIds = allParam ? allParam.split(",").filter(Boolean) : [];
  const solvedParam = searchParams.get("solved") ?? "";
  const failedParam = searchParams.get("failed") ?? "";
  const aiParam = searchParams.get("ai") ?? "";

  // Restore dialogue from sessionStorage if returning to this task
  const [saved] = useState<SavedDialogue | null>(() => {
    try {
      const raw = sessionStorage.getItem(dlgKey(id));
      return raw ? (JSON.parse(raw) as SavedDialogue) : null;
    } catch {
      return null;
    }
  });

  // Session dot states (persisted in URL)
  const [solvedPositions, setSolvedPositions] = useState<Set<number>>(
    () => new Set(solvedParam.split(",").filter(Boolean).map(Number)),
  );
  const [failedPositions, setFailedPositions] = useState<Set<number>>(
    () => new Set(failedParam.split(",").filter(Boolean).map(Number)),
  );
  const [aiPositions, setAiPositions] = useState<Set<number>>(
    () => new Set(aiParam.split(",").filter(Boolean).map(Number)),
  );

  // Dialogue state — restored from sessionStorage if available
  const [phase, setPhase] = useState<Phase>(saved?.phase ?? "question");
  const [answer, setAnswer] = useState(saved?.answer ?? "");
  const [wrongAnswer, setWrongAnswer] = useState(saved?.answer ?? "");
  const [dialogueId, setDialogueId] = useState<string | null>(saved?.dialogueId ?? null);
  const [messages, setMessages] = useState<Message[]>(saved?.messages ?? []);
  const [theoryRef, setTheoryRef] = useState<TheoryRef | null>(saved?.theoryRef ?? null);
  const [giveUpResult, setGiveUpResult] = useState<{ correct_answer: string } | null>(
    saved?.giveUpResult ?? null,
  );
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [reply, setReply] = useState("");
  const [addingMore, setAddingMore] = useState(false);
  const streamBuffer = useRef("");
  const isBooster = searchParams.get("booster") === "1";

  // Persist dialogue state to sessionStorage
  useEffect(() => {
    if (phase === "question" || phase === "correct") {
      sessionStorage.removeItem(dlgKey(id));
      return;
    }
    if (phase === "submitting") return;
    sessionStorage.setItem(
      dlgKey(id),
      JSON.stringify({ phase, answer, dialogueId, messages, theoryRef, giveUpResult }),
    );
  }, [id, phase, answer, dialogueId, messages, theoryRef, giveUpResult]);

  function buildSessionParams(overrideQueue?: string[]): URLSearchParams {
    const params = new URLSearchParams();
    const q = overrideQueue ?? queue;
    if (q.length > 0) params.set("queue", q.join(","));
    params.set("total", String(total));
    if (allIds.length > 0) params.set("all", allIds.join(","));
    const solved = Array.from(solvedPositions);
    if (solved.length > 0) params.set("solved", solved.join(","));
    const failed = Array.from(failedPositions);
    if (failed.length > 0) params.set("failed", failed.join(","));
    const ai = Array.from(aiPositions);
    if (ai.length > 0) params.set("ai", ai.join(","));
    return params;
  }

  function buildTaskUrl(targetPos: number): string {
    const targetId = allIds[targetPos - 1];
    if (!targetId) return "";
    const newQueue = allIds.slice(targetPos);
    const params = buildSessionParams(newQueue);
    return `/task/${targetId}?${params.toString()}`;
  }

  function goNext() {
    // Save to booster before leaving
    if (task) {
      const preview = task.question_text?.slice(0, 100) ?? "";
      if (phase === "wrong") {
        addToBooster({ taskId: id, topicId: task.topic_id, reason: "skipped", questionPreview: preview });
      } else if (phase === "giveup" || (phase === "dialogue" && canGoNext)) {
        addToBooster({ taskId: id, topicId: task.topic_id, reason: "ai", questionPreview: preview });
      }
    }
    if (isBooster && phase === "correct") {
      removeFromBooster(id);
    }
    if (queue.length === 0) {
      router.replace(isBooster ? "/booster" : "/today");
      return;
    }
    const [next, ...rest] = queue;
    const params = buildSessionParams(rest);
    router.push(`/task/${next}?${params.toString()}`);
  }

  async function handleAddMore() {
    if (!task || addingMore) return;
    setAddingMore(true);
    try {
      const { data: session } = await api.get<SubtopicSession>(
        `/tasks/subtopic-session?topic_id=${task.topic_id}&count=5`,
      );
      const newTasks = session.tasks.filter((t) => !allIds.includes(t.id) && t.id !== id);
      if (newTasks.length === 0) return;
      const newAllIds = [...allIds, ...newTasks.map((t) => t.id)];
      const newQueue = [...queue, ...newTasks.map((t) => t.id)];
      const newTotal = total + newTasks.length;
      const params = new URLSearchParams();
      if (newQueue.length > 0) params.set("queue", newQueue.join(","));
      params.set("total", String(newTotal));
      params.set("all", newAllIds.join(","));
      const solved = Array.from(solvedPositions);
      if (solved.length > 0) params.set("solved", solved.join(","));
      const failed = Array.from(failedPositions);
      if (failed.length > 0) params.set("failed", failed.join(","));
      const ai = Array.from(aiPositions);
      if (ai.length > 0) params.set("ai", ai.join(","));
      router.replace(`/task/${id}?${params.toString()}`);
    } finally {
      setAddingMore(false);
    }
  }

  async function startStream(dId: string) {
    if (!tokens) return;
    setStreaming(true);
    streamBuffer.current = "";
    setStreamingText("");

    try {
      const res = await fetch(`${API_URL}/dialogue/${dId}/stream`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!res.ok) {
        setStreamingText(`Ошибка ${res.status}: не удалось запустить диалог.`);
        setStreaming(false);
        return;
      }

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
      const { data } = await api.post<AnswerResult>(`/tasks/${task.id}/answer`, {
        answer: answer.trim(),
      });
      if (data.correct) {
        setPhase("correct");
        setSolvedPositions((prev) => new Set([...Array.from(prev), currentPos]));
        if (isBooster) removeFromBooster(id);
      } else if (data.dialogue_id) {
        setDialogueId(data.dialogue_id);
        setPhase("wrong");
        setWrongAnswer(answer.trim());
        setFailedPositions((prev) => new Set([...Array.from(prev), currentPos]));
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
    setAiPositions((prev) => new Set([...Array.from(prev), currentPos]));
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
    setAiPositions((prev) => new Set([...Array.from(prev), currentPos]));
    await startStream(dialogueId);
  }

  if (isLoading || !task) {
    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-2xl px-4 py-6 space-y-4">
          <div className="h-8 w-48 rounded-xl bg-fg/5 animate-pulse" />
          <div className="h-32 rounded-2xl border border-border animate-pulse bg-fg/5" />
        </main>
      </>
    );
  }

  const inSession = total > 1;
  const assistantTurns = messages.filter((m) => m.role === "assistant").length;
  const canGoNext =
    !streaming &&
    (phase === "correct" ||
      phase === "giveup" ||
      (phase === "dialogue" && assistantTurns >= 3));

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Task dots navigation */}
        {inSession && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              onClick={() => router.back()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted hover:bg-fg/5 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: total }, (_, i) => {
              const pos = i + 1;
              const isSolved = solvedPositions.has(pos);
              const isAi = aiPositions.has(pos) && !isSolved;
              const isFailed = failedPositions.has(pos) && !isSolved && !isAi;
              const isCurrent = pos === currentPos;
              const canNavigate = allIds.length > 0 && !isCurrent;
              return (
                <button
                  key={i}
                  onClick={() => {
                    if (!canNavigate) return;
                    const url = buildTaskUrl(pos);
                    if (url) router.push(url);
                  }}
                  disabled={!canNavigate}
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition",
                    isCurrent
                      ? "bg-fg text-bg cursor-default"
                      : isSolved
                        ? "bg-success/20 text-success border border-success/30 hover:opacity-80 cursor-pointer"
                        : isAi
                          ? "bg-accent/25 text-accent border border-accent/40 hover:opacity-80 cursor-pointer"
                          : isFailed
                            ? "bg-danger/20 text-danger border border-danger/30 hover:opacity-80 cursor-pointer"
                            : "bg-fg/8 text-muted border border-border hover:bg-fg/15 cursor-pointer",
                  )}
                >
                  {pos}
                </button>
              );
            })}
            <button
              onClick={handleAddMore}
              disabled={addingMore}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted hover:bg-fg/5 transition disabled:opacity-40"
              title="Ещё задания этого типа"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Task header */}
        <div className="flex items-center gap-3">
          {!inSession && (
            <button onClick={() => router.back()} className="text-muted hover:text-fg transition">
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          <h1 className="text-2xl font-bold flex-1">
            {inSession ? `Задание ${currentPos}` : "Задача"}
          </h1>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium shrink-0",
              DIFFICULTY_COLOR[task.difficulty] ?? "bg-fg/10 text-muted",
            )}
          >
            {DIFFICULTY_LABEL[task.difficulty] ?? "—"}
          </span>
        </div>

        {/* Task content */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          {task.question_text &&
            !(
              task.question_image_url &&
              (task.question_text.endsWith("...") || task.question_text.endsWith("…"))
            ) && (
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
              <Button
                size="lg"
                onClick={submitAnswer}
                disabled={!answer.trim() || phase === "submitting"}
                className="shrink-0"
              >
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
              <>
                <p className="text-sm text-muted leading-relaxed">
                  Попробуй решить задачу самостоятельно. Если ошибёшься — разберём вместе, шаг за шагом.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={goNext}
                    className="rounded-full border border-border px-4 py-2 text-sm text-muted hover:bg-fg/5 transition"
                  >
                    К следующему →
                  </button>
                </div>
              </>
            )}

            {phase === "wrong" && (
              <>
                <p className="text-sm text-muted leading-relaxed">
                  Можем разобрать задачу вместе — я задам наводящие вопросы, чтобы ты сам нашёл ошибку.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={startDialogue}
                    className="rounded-full bg-fg text-bg px-4 py-2 text-sm font-semibold hover:opacity-90 transition"
                  >
                    Помоги разобрать
                  </button>
                  <button
                    onClick={goNext}
                    className="rounded-full border border-border px-4 py-2 text-sm text-muted hover:bg-fg/5 transition"
                  >
                    К следующему →
                  </button>
                </div>
              </>
            )}

            {phase === "correct" && (
              <>
                <p className="text-sm font-medium text-success">Правильно! Отличная работа.</p>
                <button
                  onClick={goNext}
                  className="rounded-full bg-fg text-bg px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition"
                >
                  К следующему заданию →
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
                      msg.role === "assistant"
                        ? "bg-accent/10 border border-accent/15"
                        : "bg-fg/5 ml-8",
                    )}
                  >
                    <MathText text={msg.content} />
                  </div>
                ))}

                {streaming && (
                  <div className="rounded-xl px-4 py-3 text-sm leading-relaxed bg-accent/10 border border-accent/15">
                    {streamingText ? (
                      <>
                        <MathText text={streamingText} />
                        <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-fg/60" />
                      </>
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
                      <button
                        onClick={giveUp}
                        className="rounded-full border border-border px-4 py-2 text-sm text-muted hover:bg-fg/5 transition"
                      >
                        Объяснить сразу
                      </button>
                    )}
                    {canGoNext && (
                      <button
                        onClick={goNext}
                        className="rounded-full bg-fg text-bg px-5 py-2 text-sm font-semibold hover:opacity-90 transition"
                      >
                        К следующему заданию →
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

          </div>
        </div>

      </main>
    </>
  );
}
