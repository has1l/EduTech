"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Flame, Snowflake, Trophy, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useMe, useStreak, useUpdateProfile } from "@/lib/queries";
import { cn } from "@/lib/utils";

const schema = z.object({
  grade: z.union([z.literal(9), z.literal(11)]),
  current_score: z.number().int().min(3).max(100),
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

const EGE_CURRENT = [
  { value: 30, label: "~30", sub: "Начинаю" },
  { value: 50, label: "~50", sub: "Базовый" },
  { value: 70, label: "~70", sub: "Уверенный" },
  { value: 85, label: "~85", sub: "Высокий" },
] as const;

const EGE_TARGET = [
  { value: 60, label: "60+", sub: "Хорошо" },
  { value: 75, label: "75+", sub: "Отлично" },
  { value: 85, label: "85+", sub: "Высокий" },
  { value: 95, label: "95+", sub: "Топ" },
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
      current_score: me?.current_score ?? (isOge ? 3 : 50),
      target_score: me?.target_score ?? (isOge ? 4 : 80),
      exam_year: me?.exam_date ? parseInt(me.exam_date.slice(0, 4)) : currentYear,
    },
  });

  const grade = form.watch("grade");
  const formIsOge = grade === 9;

  function handleGradeChange(g: 9 | 11) {
    form.setValue("grade", g);
    form.setValue("current_score", g === 9 ? 3 : 50);
    form.setValue("target_score", g === 9 ? 4 : 80);
  }

  const onSubmit = form.handleSubmit(async (v) => {
    await mutation.mutateAsync({
      grade: v.grade,
      current_score: v.current_score,
      target_score: v.target_score,
      exam_date: `${v.exam_year}-06-01`,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  });

  const logout = () => {
    clear();
    router.replace("/login");
  };

  if (!me) return null;

  return (
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

        {/* Current score */}
        <Controller
          control={form.control}
          name="current_score"
          render={({ field }) => (
            <div>
              <span className="mb-2 block text-sm font-medium">
                {formIsOge ? "Какая оценка сейчас?" : "Какой балл сейчас (примерно)?"}
              </span>
              {formIsOge ? (
                <ScoreButtons value={field.value as 3 | 4 | 5} onChange={field.onChange} options={OGE_SCORES} />
              ) : (
                <ScoreButtons value={field.value as 30 | 50 | 70 | 85} onChange={field.onChange} options={EGE_CURRENT} cols={4} />
              )}
            </div>
          )}
        />

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
                <ScoreButtons value={field.value as 3 | 4 | 5} onChange={field.onChange} options={OGE_SCORES} />
              ) : (
                <ScoreButtons value={field.value as 60 | 75 | 85 | 95} onChange={field.onChange} options={EGE_TARGET} cols={4} />
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
  );
}
