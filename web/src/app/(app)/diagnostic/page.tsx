"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, SkipForward, Loader2, ClipboardList, Clock, BarChart2 } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/math-text";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMe } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { DiagnosticResult, DiagnosticSession, Task } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

function TaskImage({ url }: { url: string }) {
  const src =
    url.startsWith("data:") || url.startsWith("https://storage.yandexcloud.net")
      ? url
      : `${API_URL}/tasks/image-proxy?url=${encodeURIComponent(url)}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Условие задачи"
      className="max-w-full rounded-xl border border-border mx-auto block"
      style={{ maxHeight: 320 }}
    />
  );
}

function isEllipsis(text: string) {
  return text.endsWith("...") || text.endsWith("…");
}

export default function DiagnosticPage() {
  const router = useRouter();
  const tokens = useAuth((s) => s.tokens);
  const { data: me } = useMe();
  const examLabel = me?.grade != null && me.grade <= 9
    ? "ОГЭ · Математика"
    : "ЕГЭ · Профильная математика";

  const [phase, setPhase] = useState<"intro" | "loading" | "quiz">("intro");
  const [session, setSession] = useState<DiagnosticSession | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function startDiagnostic() {
    if (!tokens) return;
    setPhase("loading");
    api
      .post<DiagnosticSession>("/diagnostic/start", {})
      .then(({ data }) => {
        setSession(data);
        setPhase("quiz");
      })
      .catch(() => {
        setLoadError(true);
        setPhase("intro");
      });
  }

  useEffect(() => {
    if (phase === "quiz") inputRef.current?.focus();
  }, [current, phase]);

  const tasks = session?.tasks ?? [];
  const task: Task | undefined = tasks[current];
  const totalTasks = tasks.length;
  const isLast = current === totalTasks - 1;
  const progress = totalTasks > 0 ? ((current + 1) / totalTasks) * 100 : 0;

  function setAnswer(taskId: string, val: string) {
    setAnswers((prev) => ({ ...prev, [taskId]: val }));
  }

  function goNext() {
    if (current < totalTasks - 1) setCurrent((c) => c + 1);
  }

  function goPrev() {
    if (current > 0) setCurrent((c) => c - 1);
  }

  async function handleSubmit() {
    if (!session) return;
    setSubmitting(true);
    try {
      const answersPayload = tasks.map((t) => ({
        task_id: t.id,
        answer: answers[t.id] ?? "",
      }));
      const { data: result } = await api.post<DiagnosticResult>("/diagnostic/submit", {
        session_id: session.session_id,
        answers: answersPayload,
      });
      sessionStorage.setItem("diagnostic_result", JSON.stringify(result));
      router.push("/diagnostic/result");
    } catch {
      setSubmitting(false);
    }
  }

  if (phase === "intro" || phase === "loading") {
    return (
      <>
        <AppNav />
        <main className="mx-auto flex min-h-[calc(100vh-56px)] max-w-md flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/15">
            <ClipboardList className="h-10 w-10 text-accent" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Пробный тест</h1>
          <p className="mt-3 text-sm text-muted leading-relaxed max-w-xs">
            Пройди короткую диагностику — мы определим твой текущий уровень и составим
            индивидуальный план подготовки.
          </p>

          <div className="mt-8 w-full space-y-3">
            <div className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-left">
              <ClipboardList className="h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="text-sm font-medium">12 заданий</p>
                <p className="text-xs text-muted">Задания 1–12 из {examLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-left">
              <Clock className="h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="text-sm font-medium">15–20 минут</p>
                <p className="text-xs text-muted">Можно пропустить трудные задания</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3 text-left">
              <BarChart2 className="h-5 w-5 shrink-0 text-accent" />
              <div>
                <p className="text-sm font-medium">Персональный план</p>
                <p className="text-xs text-muted">AI составит маршрут по слабым темам</p>
              </div>
            </div>
          </div>

          {loadError && (
            <p className="mt-4 text-sm text-danger">Не удалось загрузить задания. Попробуй ещё раз.</p>
          )}

          <Button
            size="lg"
            className="mt-8 w-full"
            onClick={startDiagnostic}
            disabled={phase === "loading"}
          >
            {phase === "loading" ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Загружаем задания…</>
            ) : (
              "Начать диагностику"
            )}
          </Button>
          <button
            onClick={() => router.replace("/today")}
            disabled={phase === "loading"}
            className="mt-3 text-sm text-muted hover:text-fg transition disabled:opacity-40"
          >
            Пропустить
          </button>
        </main>
      </>
    );
  }

  if (!task) {
    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <p className="text-muted">Не удалось загрузить задания. Попробуйте позже.</p>
        </main>
      </>
    );
  }

  const showText = !(isEllipsis(task.question_text) && task.question_image_url);

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-md px-4 py-6 flex flex-col gap-6">
        {/* Header */}
        <div>
          <p className="text-xs text-muted mb-1">Диагностика · {examLabel}</p>
          <h1 className="text-lg font-bold">Задание {task.topic_id ? current + 1 : "?"}</h1>
        </div>

        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted">
            <span>Задание {current + 1} из {totalTasks}</span>
            <span>{Object.keys(answers).filter((k) => answers[k]).length} отвечено</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-fg/10 overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Task card */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 min-h-[200px]">
          {task.question_image_url && <TaskImage url={task.question_image_url} />}
          {showText && (
            <MathText text={task.question_text} className="text-sm leading-relaxed whitespace-pre-wrap" />
          )}
        </div>

        {/* Answer input */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted">Ваш ответ</label>
          <input
            ref={inputRef}
            type="text"
            value={answers[task.id] ?? ""}
            onChange={(e) => setAnswer(task.id, e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isLast && goNext()}
            placeholder="Введите ответ…"
            className={cn(
              "w-full rounded-xl border border-border bg-bg px-4 py-3 text-sm outline-none",
              "focus:border-accent focus:ring-2 focus:ring-accent/20 transition",
            )}
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button
            onClick={goPrev}
            disabled={current === 0}
            className="flex items-center justify-center h-11 w-11 rounded-xl border border-border text-muted disabled:opacity-30 hover:bg-fg/5 transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {!isLast && !answers[task.id] && (
            <button
              onClick={goNext}
              className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm text-muted hover:bg-fg/5 transition"
            >
              <SkipForward className="h-4 w-4" />
              Пропустить
            </button>
          )}

          {!isLast && (
            <Button
              onClick={goNext}
              disabled={!answers[task.id]}
              className="flex-1"
            >
              Далее
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}

          {isLast && (
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Отправляем…</>
              ) : (
                "Завершить диагностику"
              )}
            </Button>
          )}
        </div>

        {/* Task dots preview */}
        <div className="flex flex-wrap gap-1.5 justify-center">
          {tasks.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setCurrent(i)}
              className={cn(
                "h-7 w-7 rounded-full text-[11px] font-semibold transition",
                i === current
                  ? "bg-accent text-accent-fg"
                  : answers[t.id]
                    ? "bg-success/20 text-success border border-success/30"
                    : "bg-fg/8 text-muted border border-border hover:bg-fg/12",
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </main>
    </>
  );
}
