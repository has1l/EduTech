"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Flame, Snowflake, Trophy, LogOut, ClipboardList } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMe, useStreak, useUpdateProfile } from "@/lib/queries";
import { cn } from "@/lib/utils";

const schema = z.object({
  grade: z.union([z.literal(9), z.literal(11)]),
  target_score: z.number().int().min(3).max(100),
  exam_year: z.number().int().min(2025).max(2030),
});

type FormValues = z.infer<typeof schema>;

const currentYear = new Date().getFullYear();
const EXAM_YEARS = [currentYear, currentYear + 1, currentYear + 2];

const OGE_SCORES = [
  { value: 3, label: "3", sub: "Трояк" },
  { value: 4, label: "4", sub: "Хорошо" },
  { value: 5, label: "5", sub: "Отлично" },
] as const;


const EGE_TARGET = [
  { value: 40, label: "40+", sub: "Начало" },
  { value: 55, label: "55+", sub: "Хорошо" },
  { value: 65, label: "65+", sub: "Отлично" },
  { value: 70, label: "70", sub: "Максимум" },
] as const;

function ScoreButtons<T extends number>({
  value,
  onChange,
  options,
  cols = 3,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string; sub: string }[];
  cols?: 3 | 4;
}) {
  return (
    <div className={cn("grid gap-3", cols === 4 ? "grid-cols-4" : "grid-cols-3")}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-2xl border py-3 text-center transition",
              active ? "border-fg bg-fg text-bg" : "border-border hover:bg-fg/5",
            )}
          >
            <div className="text-xl font-bold">{o.label}</div>
            <div className={cn("text-xs mt-0.5", active ? "text-bg/60" : "text-muted")}>
              {o.sub}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Avatar({ name, email }: { name: string | null; email: string }) {
  const initials = name
    ? name
        .split(" ")
        .slice(0, 2)
        .map((w) => w[0])
        .join("")
        .toUpperCase()
    : email[0].toUpperCase();
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl font-bold text-accent-fg">
      {initials}
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const clear = useAuth((s) => s.clear);
  const { data: me } = useMe();
  const { data: streak } = useStreak();
  const mutation = useUpdateProfile();
  const [saved, setSaved] = useState(false);

  const isOge = me?.grade != null && me.grade <= 9;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      grade: (me?.grade === 9 ? 9 : 11) as 9 | 11,
      target_score: me?.target_score ?? (isOge ? 4 : 65),
      exam_year: me?.exam_date ? parseInt(me.exam_date.slice(0, 4)) : currentYear,
    },
  });

  const grade = form.watch("grade");
  const formIsOge = grade === 9;

  function handleGradeChange(g: 9 | 11) {
    form.setValue("grade", g);
    form.setValue("target_score", g === 9 ? 4 : 65);
  }

  const onSubmit = form.handleSubmit(async (v) => {
    await mutation.mutateAsync({
      grade: v.grade,
      target_score: v.target_score,
      exam_date: `${v.exam_year}-06-01`,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  });

  const logout = () => {
    // Clear remaining client-side state (drawings, dialogue cache)
    Object.keys(localStorage)
      .filter((k) => k.startsWith("drawing_"))
      .forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
    clear();
    router.replace("/login");
  };

  if (!me) return null;

  return (
    <>
      <AppNav />
      <main className="mx-auto w-full max-w-xl px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Avatar name={me.name} email={me.email} />
        <div>
          <div className="text-xl font-bold">{me.name ?? "Без имени"}</div>
          <div className="text-sm text-muted">{me.email}</div>
        </div>
      </div>

      {/* Streak card */}
      <div className="mb-8 grid grid-cols-3 divide-x divide-border rounded-2xl border border-border">
        <div className="flex flex-col items-center gap-1 p-4">
          <Flame className="h-5 w-5 text-accent" />
          <div className="text-2xl font-bold">{streak?.current_streak ?? 0}</div>
          <div className="text-xs text-muted">Серия</div>
        </div>
        <div className="flex flex-col items-center gap-1 p-4">
          <Trophy className="h-5 w-5 text-accent" />
          <div className="text-2xl font-bold">{streak?.longest_streak ?? 0}</div>
          <div className="text-xs text-muted">Рекорд</div>
        </div>
        <div className="flex flex-col items-center gap-1 p-4">
          <Snowflake className="h-5 w-5 text-accent" />
          <div className="text-2xl font-bold">{streak?.freezes_available ?? 0}</div>
          <div className="text-xs text-muted">Заморозки</div>
        </div>
      </div>

      {/* Current level */}
      {me.current_score != null ? (
        <div className="mb-8 rounded-2xl border border-border px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted mb-0.5">Текущий уровень по диагностике</p>
            <p className="text-2xl font-black">
              {isOge ? `Оценка ${me.current_score}` : `${me.current_score} баллов`}
            </p>
          </div>
          <Link
            href="/diagnostic"
            className="text-xs text-muted hover:text-accent transition underline underline-offset-2"
          >
            Пройти заново
          </Link>
        </div>
      ) : (
        <Link
          href="/diagnostic"
          className="mb-8 flex items-center gap-3 rounded-2xl border border-dashed border-border px-5 py-4 hover:border-accent hover:bg-accent/5 transition"
        >
          <ClipboardList className="h-5 w-5 shrink-0 text-accent" />
          <div>
            <p className="text-sm font-medium">Диагностика не пройдена</p>
            <p className="text-xs text-muted">Пройди тест — мы определим твой уровень</p>
          </div>
        </Link>
      )}

      {/* Exam settings */}
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <h2 className="text-lg font-semibold">Настройки экзамена</h2>

        {/* Grade */}
        <div>
          <span className="mb-2 block text-sm font-medium">К чему готовишься</span>
          <div className="grid grid-cols-2 gap-3">
            {([{ value: 9, label: "ОГЭ" }, { value: 11, label: "ЕГЭ" }] as const).map((g) => {
              const active = grade === g.value;
              return (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => handleGradeChange(g.value)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
                    active ? "border-fg bg-fg text-bg" : "border-border hover:bg-fg/5",
                  )}
                >
                  <div className="text-lg font-semibold">{g.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Target score */}
        <Controller
          control={form.control}
          name="target_score"
          render={({ field }) => (
            <div>
              <span className="mb-2 block text-sm font-medium">
                {formIsOge ? "Какую оценку хочешь получить?" : "Какой балл хочешь набрать?"}
              </span>
              {formIsOge ? (
                <>
                  <ScoreButtons value={field.value as 3 | 4 | 5} onChange={field.onChange} options={OGE_SCORES} />
                  <p className="mt-2 text-xs text-muted">
                    Охватываем задания 6–19 ОГЭ (Часть 1). Задания 1–5 не входят в курс.
                  </p>
                </>
              ) : (
                <>
                  <ScoreButtons value={field.value as 40 | 55 | 65 | 70} onChange={field.onChange} options={EGE_TARGET} cols={4} />
                  <p className="mt-2 text-xs text-muted">
                    Сейчас мы охватываем только Часть 1 (задания 1–12). Максимум за неё — 70 тестовых баллов.
                  </p>
                </>
              )}
            </div>
          )}
        />

        {/* Exam year */}
        <Controller
          control={form.control}
          name="exam_year"
          render={({ field }) => (
            <div>
              <span className="mb-2 block text-sm font-medium">Год экзамена</span>
              <div className="grid grid-cols-3 gap-3">
                {EXAM_YEARS.map((y) => {
                  const active = field.value === y;
                  return (
                    <button
                      key={y}
                      type="button"
                      onClick={() => field.onChange(y)}
                      className={cn(
                        "rounded-2xl border py-3 text-center font-semibold transition",
                        active ? "border-fg bg-fg text-bg" : "border-border hover:bg-fg/5",
                      )}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        />

        {mutation.error && (
          <p className="text-sm text-danger">{apiErrorMessage(mutation.error)}</p>
        )}

        <Button type="submit" size="lg" disabled={mutation.isPending}>
          {mutation.isPending ? "Сохраняем..." : saved ? "Сохранено ✓" : "Сохранить"}
        </Button>
      </form>

      {/* Logout */}
      <div className="mt-10 border-t border-border pt-6">
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-muted hover:text-danger transition"
        >
          <LogOut className="h-4 w-4" />
          Выйти из аккаунта
        </button>
      </div>
    </main>
    </>
  );
}
