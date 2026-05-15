"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ChevronLeft, Eraser, Pencil, Plus, X } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { MathText } from "@/components/math-text";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTask, useAddToBooster, useRemoveFromBooster, useAddToKB } from "@/lib/queries";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { AnswerResult, SubtopicSession } from "@/lib/types";

const THRESHOLD = 5;

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
type Stroke = { id: string; points: [number, number][]; color: string; width: number };

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

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length === 0) return;
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "source-over";
  if (stroke.points.length === 1) {
    ctx.beginPath();
    ctx.arc(stroke.points[0][0], stroke.points[0][1], stroke.width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.moveTo(stroke.points[0][0], stroke.points[0][1]);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i][0], stroke.points[i][1]);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2);
}

function strokeHit(stroke: Stroke, x: number, y: number, threshold: number): boolean {
  const pts = stroke.points;
  if (pts.length === 0) return false;
  if (pts.length === 1) return Math.sqrt((x - pts[0][0]) ** 2 + (y - pts[0][1]) ** 2) < threshold;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegment(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) < threshold) return true;
  }
  return false;
}

export default function TaskPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokens = useAuth((s) => s.tokens);
  const queryClient = useQueryClient();
  const { data: task, isLoading } = useTask(id);
  const addToBoosterMutation = useAddToBooster();
  const removeFromBoosterMutation = useRemoveFromBooster();
  const addToKBMutation = useAddToKB();

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
  const [streakFlash, setStreakFlash] = useState<number | null>(null);
  const streamBuffer = useRef("");
  const isBooster = searchParams.get("booster") === "1";
  const isReview = searchParams.get("review") === "1";

  // Drawing — stroke-based (each pen-down→pen-up = one Stroke object)
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef({ isDrawing: false });
  const currentStrokeRef = useRef<Stroke | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;
  const [activeTool, setActiveTool] = useState<"marker" | "eraser" | null>(null);

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

  // ─── Canvas setup ────────────────────────────────────────────────────────────

  function redrawAll() {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of strokesRef.current) drawStroke(ctx, s);
  }

  // Load strokes from localStorage when task changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    try {
      const raw = localStorage.getItem(`drawing_${id}`);
      const loaded: Stroke[] = raw ? JSON.parse(raw) : [];
      strokesRef.current = loaded;
      setStrokes(loaded);
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of loaded) drawStroke(ctx, s);
    } catch {
      strokesRef.current = [];
      setStrokes([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, task?.id]);

  // Redraw when strokes state changes (erases cause this)
  useEffect(() => {
    redrawAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  // Keep canvas sized to window
  useEffect(() => {
    function handleResize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      redrawAll();
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Drawing handlers ────────────────────────────────────────────────────────

  function getCanvasPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function eraseAt(x: number, y: number) {
    const next = strokesRef.current.filter((s) => !strokeHit(s, x, y, 14));
    if (next.length !== strokesRef.current.length) {
      strokesRef.current = next;
      setStrokes([...next]);
    }
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!activeTool) return;
    e.preventDefault();
    canvasRef.current!.setPointerCapture(e.pointerId);
    const { x, y } = getCanvasPos(e);
    drawingRef.current.isDrawing = true;

    if (activeTool === "marker") {
      const s: Stroke = { id: Math.random().toString(36).slice(2), points: [[x, y]], color: "#ef4444", width: 3 };
      currentStrokeRef.current = s;
      drawStroke(canvasRef.current!.getContext("2d")!, s);
    } else {
      eraseAt(x, y);
    }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current.isDrawing || !activeTool) return;
    const { x, y } = getCanvasPos(e);

    if (activeTool === "marker" && currentStrokeRef.current) {
      const prev = currentStrokeRef.current.points.at(-1)!;
      currentStrokeRef.current.points.push([x, y]);
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.save();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(prev[0], prev[1]);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();
    } else if (activeTool === "eraser") {
      eraseAt(x, y);
    }
  }

  function onPointerUp() {
    if (!drawingRef.current.isDrawing) return;
    drawingRef.current.isDrawing = false;

    if (activeTool === "marker" && currentStrokeRef.current) {
      const next = [...strokesRef.current, currentStrokeRef.current];
      strokesRef.current = next;
      setStrokes(next);
      localStorage.setItem(`drawing_${id}`, JSON.stringify(next));
      currentStrokeRef.current = null;
    } else if (activeTool === "eraser") {
      localStorage.setItem(`drawing_${id}`, JSON.stringify(strokesRef.current));
    }
  }

  function clearDrawing() {
    strokesRef.current = [];
    setStrokes([]);
    localStorage.removeItem(`drawing_${id}`);
  }

  // ─── Session helpers ─────────────────────────────────────────────────────────

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
    if (queue.length === 0) {
      router.replace(isBooster ? "/booster" : isReview ? "/progress" : "/today");
      return;
    }
    const [next, ...rest] = queue;
    const params = buildSessionParams(rest);
    if (isReview) params.set("review", "1");
    router.push(`/task/${next}?${params.toString()}`);
  }

  function finishSession() {
    if (task && allIds.length > 0) {
      allIds.forEach((taskId, idx) => {
        const pos = idx + 1;
        if (!solvedPositions.has(pos)) {
          const reason = aiPositions.has(pos) ? "ai" : "skipped";
          const preview = taskId === id ? (task.question_text?.slice(0, 100) ?? "") : "";
          addToBoosterMutation.mutate({ task_id: taskId, topic_id: task.topic_id, reason, question_preview: preview });
        }
      });
    }
    router.replace(isBooster ? "/booster" : isReview ? "/session?unlocked=1" : "/session");
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
        const newSolvedSize = solvedPositions.has(currentPos)
          ? solvedPositions.size
          : solvedPositions.size + 1;
        setSolvedPositions((prev) => new Set([...Array.from(prev), currentPos]));
        removeFromBoosterMutation.mutate(id);
        addToKBMutation.mutate({ task_id: id, topic_id: task.topic_id });
        if (newSolvedSize === THRESHOLD) {
          api.post<{ current_streak: number }>("/streak/record", {}).then(({ data: s }) => {
            queryClient.invalidateQueries({ queryKey: ["streak"] });
            setStreakFlash(s.current_streak);
            setTimeout(() => setStreakFlash(null), 3000);
          }).catch(() => {});
        }
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
  const selfSolvedCount = solvedPositions.size;
  const thresholdReached = selfSolvedCount >= THRESHOLD;
  const assistantTurns = messages.filter((m) => m.role === "assistant").length;
  const canGoNext =
    !streaming &&
    (phase === "correct" ||
      phase === "giveup" ||
      (phase === "dialogue" && assistantTurns >= 3));

  return (
    <>
      <AppNav />

      {/* Full-page drawing canvas — fixed overlay, active only when tool selected */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-40"
        style={{
          pointerEvents: activeTool ? "auto" : "none",
          cursor: activeTool === "marker" ? "crosshair" : activeTool === "eraser" ? "cell" : "default",
          touchAction: activeTool ? "none" : "auto",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />

      {/* Streak celebration */}
      {streakFlash !== null && (
        <div className="fixed inset-x-0 top-16 z-50 flex justify-center pointer-events-none">
          <div className="animate-bounce-in flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 shadow-lg text-accent-fg font-bold text-base">
            <span className="text-2xl">🔥</span>
            {streakFlash} {streakFlash === 1 ? "день" : streakFlash < 5 ? "дня" : "дней"} подряд!
          </div>
        </div>
      )}

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Task dots navigation */}
        {inSession && (
          <div className="space-y-2">
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
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              {thresholdReached ? (
                <span className="text-success font-medium">✓ Порог пройден — {selfSolvedCount}/{THRESHOLD}</span>
              ) : (
                <span>{selfSolvedCount}/{THRESHOLD} для разблокировки следующего подтипа</span>
              )}
            </span>
            <button
              onClick={finishSession}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-semibold transition border",
                thresholdReached
                  ? "bg-success text-white border-success hover:opacity-90"
                  : "bg-bg border-border text-muted hover:bg-fg/5",
              )}
            >
              Завершить
            </button>
          </div>
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

        {/* Drawing toolbar — relative z-50 so it stays clickable above the canvas */}
        <div className="relative z-50 flex items-center gap-1.5">
          <button
            onClick={() => setActiveTool((t) => (t === "marker" ? null : "marker"))}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition border",
              activeTool === "marker"
                ? "bg-danger/15 text-danger border-danger/30"
                : "border-border text-muted hover:bg-fg/5",
            )}
          >
            <Pencil className="h-3.5 w-3.5" />
            Маркер
          </button>
          <button
            onClick={() => setActiveTool((t) => (t === "eraser" ? null : "eraser"))}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition border",
              activeTool === "eraser"
                ? "bg-fg/10 text-fg border-fg/20"
                : "border-border text-muted hover:bg-fg/5",
            )}
          >
            <Eraser className="h-3.5 w-3.5" />
            Ластик
          </button>
          {strokes.length > 0 && (
            <button
              onClick={clearDrawing}
              className="rounded-full border border-border p-1.5 text-muted hover:bg-fg/5 transition"
              title="Очистить рисунок"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {activeTool && (
            <span className="ml-auto text-xs text-muted animate-pulse">
              {activeTool === "marker" ? "Рисуй на экране" : "Нажми на линию — она исчезнет"}
            </span>
          )}
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
              className="max-h-64 w-auto rounded-xl object-contain"
            />
          )}
        </div>

        {/* Answer input */}
        {(phase === "question" || phase === "submitting" || phase === "wrong") && (
          <div className="relative z-50 space-y-2">
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
        <div className="relative z-50 rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <video
              src="/mascot/idle.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="h-9 w-9 shrink-0 rounded-full object-cover"
              style={{ mixBlendMode: "multiply" }}
            />
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
                <div className="flex items-center gap-3">
                  <video
                    src="/mascot/investigating.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-12 w-12 shrink-0 rounded-full object-cover"
                    style={{ mixBlendMode: "multiply" }}
                  />
                  <p className="text-sm text-muted leading-relaxed">
                    Можем разобрать задачу вместе — я задам наводящие вопросы, чтобы ты сам нашёл ошибку.
                  </p>
                </div>
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
                  msg.role === "assistant" ? (
                    <div key={i} className="flex items-start gap-2">
                      <video
                        src="/mascot/thinking.mp4"
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="h-9 w-9 shrink-0 rounded-full object-cover mt-0.5"
                        style={{ mixBlendMode: "multiply" }}
                      />
                      <div className="rounded-xl px-4 py-3 text-sm leading-relaxed bg-accent/10 border border-accent/15 flex-1">
                        <MathText text={msg.content} />
                      </div>
                    </div>
                  ) : (
                    <div key={i} className="rounded-xl px-4 py-3 text-sm leading-relaxed bg-fg/5 ml-8">
                      <MathText text={msg.content} />
                    </div>
                  )
                ))}

                {streaming && (
                  <div className="flex items-start gap-2">
                    <video
                      key={streamingText ? "writing" : "investigating"}
                      src={streamingText ? "/mascot/thinking.mp4" : "/mascot/investigating.mp4"}
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="h-9 w-9 shrink-0 rounded-full object-cover mt-0.5"
                      style={{ mixBlendMode: "multiply" }}
                    />
                    <div className="rounded-xl px-4 py-3 text-sm leading-relaxed bg-accent/10 border border-accent/15 flex-1">
                      {streamingText ? (
                        <>
                          <MathText text={streamingText} />
                          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-fg/60" />
                        </>
                      ) : (
                        <span className="text-muted">AI думает...</span>
                      )}
                    </div>
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
