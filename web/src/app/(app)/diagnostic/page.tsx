"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, SkipForward, Loader2 } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { DiagnosticResult, DiagnosticSession, Task } from "@/lib/types";

function TaskImage({ url }: { url: string }) {
  const src = url.startsWith("data:") ? url : `/api/v1/tasks/image-proxy?url=${encodeURIComponent(url)}`;
  return (
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

  const [session, setSession] = useState<DiagnosticSession | null>(null);
  const [loadingStart, setLoadingStart] = useState(true);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tokens) return;
    api
      .post<DiagnosticSession>("/diagnostic/start", {})
      .then(({ data }) => {
        setSession(data);
        setLoadingStart(false);
      })
      .catch(() => setLoadingStart(false));
  }, [tokens]);

  useEffect(() => {
    if (!loadingStart) inputRef.current?.focus();
  }, [current, loadingStart]);

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

  if (loadingStart) {
    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-md px-6 py-16 flex flex-col items-center gap-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm text-muted">Загружаем задания из варианта ЕГЭ…</p>
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
          <p className="text-xs text-muted mb-1">Диагностика · ЕГЭ Профильная математика</p>
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
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.question_text}</p>
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
