"use client";

import { useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { MathText } from "@/components/math-text";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useTask } from "@/lib/queries";
import { cn } from "@/lib/utils";
import type { AnswerResult } from "@/lib/types";

const DIFFICULTY_LABEL: Record<number, string> = {
  1: "Лёгкий",
  2: "Средний",
  3: "Сложный",
};

type Phase = "question" | "submitting" | "correct" | "dialogue" | "giveup";
type Message = { role: "user" | "assistant"; content: string };
type TheoryRef = { title: string; section_id: string };

export default function TaskPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokens = useAuth((s) => s.tokens);
  const { data: task, isLoading } = useTask(id);

  const queueParam = searchParams.get("queue") ?? "";
  const queue = queueParam ? queueParam.split(",").filter(Boolean) : [];
  const totalInSession = queue.length + 1;

  function goNext() {
    if (queue.length === 0) {
      goNext();
    } else {
      const [next, ...rest] = queue;
      const url = rest.length > 0 ? `/task/${next}?queue=${rest.join(",")}` : `/task/${next}`;
      router.push(url);
    }
  }

  const [answer, setAnswer] = useState("");
  const [phase, setPhase] = useState<Phase>("question");
  const [dialogueId, setDialogueId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [theoryRef, setTheoryRef] = useState<TheoryRef | null>(null);
  const [reply, setReply] = useState("");
  const [giveUpResult, setGiveUpResult] = useState<{
    correct_answer: string;
  } | null>(null);
  const streamBuffer = useRef("");

  const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

  async function startStream(dId: string) {
    if (!tokens) return;
    setStreaming(true);
    streamBuffer.current = "";
    setStreamingText("");

    const streamUrl = `${API_URL}/dialogue/${dId}/stream`;

    try {
      const res = await fetch(streamUrl, {
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
            const text = JSON.parse(dataStr) as string;
            streamBuffer.current += text;
            setStreamingText(streamBuffer.current);
          } else if (evName === "meta") {
            const meta = JSON.parse(dataStr) as {
              theory_ref: TheoryRef | null;
            };
            if (meta.theory_ref) setTheoryRef(meta.theory_ref);
          } else if (evName === "done") {
            const finalText = streamBuffer.current;
            streamBuffer.current = "";
            setStreamingText("");
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: finalText },
            ]);
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
      } else if (data.dialogue_id) {
        setDialogueId(data.dialogue_id);
        setPhase("dialogue");
        await startStream(data.dialogue_id);
      } else {
        setPhase("question");
      }
    } catch {
      setPhase("question");
    }
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
    await startStream(dialogueId);
  }

  if (isLoading || !task) {
    return (
      <>
        <AppNav />
        <main className="mx-auto max-w-2xl px-6 py-10">
          <div className="h-8 w-48 rounded-xl bg-fg/5 animate-pulse" />
          <div className="mt-6 h-32 rounded-3xl border border-border animate-pulse bg-fg/5" />
        </main>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-2xl space-y-5 px-6 py-10">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Link href="/session" className="text-muted transition hover:text-fg">
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <span className="text-sm text-muted flex-1">{DIFFICULTY_LABEL[task.difficulty]}</span>
            {totalInSession > 1 && (
              <span className="text-xs text-muted tabular-nums">
                {totalInSession - queue.length} / {totalInSession}
              </span>
            )}
          </div>
          {totalInSession > 1 && (
            <div className="h-1.5 w-full rounded-full bg-fg/10">
              <div
                className="h-full rounded-full bg-accent transition-all duration-300"
                style={{ width: `${((totalInSession - queue.length) / totalInSession) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Question */}
        <section className="rounded-3xl border border-border p-6 space-y-4">
          {task.question_text && !(task.question_image_url && (task.question_text.endsWith("...") || task.question_text.endsWith("…"))) && (
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
        </section>

        {/* Answer input */}
        {phase === "question" && (
          <section className="flex gap-2">
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitAnswer()}
              placeholder="Введи ответ..."
              className="flex-1 rounded-2xl border border-border bg-transparent px-4 py-3 text-sm outline-none transition focus:border-fg/40"
            />
            <Button size="lg" onClick={submitAnswer} disabled={!answer.trim()}>
              →
            </Button>
          </section>
        )}

        {/* Wrong answer highlight */}
        {phase === "dialogue" && answer && (
          <div className="rounded-2xl border border-danger/60 bg-danger/10 px-4 py-3 text-sm text-danger">
            Твой ответ: <span className="font-semibold">{answer}</span> — неверно
          </div>
        )}

        {phase === "submitting" && (
          <p className="text-center text-sm text-muted">Проверяем...</p>
        )}

        {/* Correct */}
        {phase === "correct" && (
          <section className="rounded-3xl border border-success/40 bg-success/10 p-5 text-center">
            <p className="text-lg font-bold text-success">Верно!</p>
            <p className="mt-1 text-sm text-muted">Отличная работа</p>
            <Button className="mt-4" onClick={() => goNext()}>
              Следующее задание
            </Button>
          </section>
        )}

        {/* AI Dialogue */}
        {(phase === "dialogue" || phase === "giveup") && (
          <section className="space-y-3">
            {/* Chat bubbles */}
            <div className="rounded-3xl border border-border p-4 space-y-3 bg-fg/[0.015]">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    msg.role === "assistant"
                      ? "bg-accent/15 border border-accent/20"
                      : "bg-border/60 ml-10",
                  )}
                >
                  <MathText text={msg.content} />
                </div>
              ))}

              {streaming && (
                <div className="rounded-2xl px-4 py-3 text-sm leading-relaxed bg-accent/15 border border-accent/20">
                  {streamingText
                    ? <><MathText text={streamingText} /><span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-fg/60" /></>
                    : <span className="text-muted">AI думает...</span>
                  }
                </div>
              )}
            </div>

            {/* Theory ref */}
            {theoryRef && (
              <div className="flex items-center gap-2 rounded-2xl border border-border px-4 py-3 text-sm">
                <BookOpen className="h-4 w-4 shrink-0 text-muted" />
                <span className="text-muted">Теория:</span>
                <span className="font-medium">{theoryRef.title}</span>
              </div>
            )}

            {/* Give-up: correct answer banner */}
            {phase === "giveup" && giveUpResult && (
              <div className="rounded-2xl border border-success/40 bg-success/10 px-4 py-3 text-sm">
                Правильный ответ:{" "}
                <span className="font-semibold text-success">{giveUpResult.correct_answer}</span>
              </div>
            )}

            {/* Reply input */}
            {(phase === "dialogue" || phase === "giveup") && !streaming && messages.length > 0 && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && !e.shiftKey && sendReply()
                    }
                    placeholder="Напиши свой ответ..."
                    className="flex-1 rounded-2xl border border-border bg-transparent px-4 py-3 text-sm outline-none transition focus:border-fg/40"
                  />
                  <Button onClick={sendReply} disabled={!reply.trim()}>
                    →
                  </Button>
                </div>
                {phase === "dialogue" && (
                  <button
                    onClick={giveUp}
                    className="text-xs text-muted underline underline-offset-2 transition hover:text-fg"
                  >
                    Объяснить сразу
                  </button>
                )}
              </div>
            )}

            {/* Go to next: after 3 AI turns in dialogue, or always in giveup */}
            {!streaming && (
              (phase === "giveup" ||
                (phase === "dialogue" &&
                  messages.filter((m) => m.role === "assistant").length >= 3))
            ) && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => goNext()}
              >
                Следующее задание
              </Button>
            )}
          </section>
        )}
      </main>
    </>
  );
}
