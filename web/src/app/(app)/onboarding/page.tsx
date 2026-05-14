"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { apiErrorMessage } from "@/lib/api";
import { useUpdateProfile } from "@/lib/queries";
import { cn } from "@/lib/utils";

const schema = z.object({
  grade: z.union([z.literal(9), z.literal(11)]),
  current_score: z.number({ error: "Выбери значение" }).int().min(3).max(100),
  target_score: z.number({ error: "Выбери значение" }).int().min(3).max(100),
  exam_year: z.number().int().min(2025).max(2030),
});

type FormValues = z.infer<typeof schema>;

const GRADES = [
  { value: 9, label: "ОГЭ", subtitle: "9 класс" },
  { value: 11, label: "ЕГЭ", subtitle: "11 класс" },
] as const;

const OGE_SCORES = [
  { value: 3, label: "3", sub: "Трояк" },
  { value: 4, label: "4", sub: "Хорошо" },
  { value: 5, label: "5", sub: "Отлично" },
] as const;

const currentYear = new Date().getFullYear();
const EXAM_YEARS = [currentYear, currentYear + 1, currentYear + 2];

function ScoreButtons({
  value,
  onChange,
  options,
}: {
  value: number;
  onChange: (v: number) => void;
  options: readonly { value: number; label: string; sub: string }[];
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-2xl border py-4 text-center transition",
              active ? "border-fg bg-fg text-bg" : "border-border hover:bg-fg/5",
            )}
          >
            <div className="text-2xl font-bold">{o.label}</div>
            <div className={cn("text-xs mt-0.5", active ? "text-bg/60" : "text-muted")}>
              {o.sub}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const mutation = useUpdateProfile();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { grade: 11, current_score: 50, target_score: 80, exam_year: currentYear },
  });

  const grade = form.watch("grade");
  const isOge = grade === 9;

  function handleGradeChange(g: 9 | 11) {
    form.setValue("grade", g);
    form.setValue("current_score", g === 9 ? 3 : 50);
    form.setValue("target_score", g === 9 ? 4 : 80);
  }

  const egeScoreOptions = [
    { value: 30, label: "~30", sub: "Начинаю" },
    { value: 50, label: "~50", sub: "Базовый" },
    { value: 70, label: "~70", sub: "Уверенный" },
    { value: 85, label: "~85", sub: "Высокий" },
  ] as const;

  const egeTargetOptions = [
    { value: 60, label: "60+", sub: "Хорошо" },
    { value: 75, label: "75+", sub: "Отлично" },
    { value: 85, label: "85+", sub: "Высокий" },
    { value: 95, label: "95+", sub: "Топ" },
  ] as const;

  const onSubmit = form.handleSubmit(async (v) => {
    await mutation.mutateAsync({
      grade: v.grade,
      current_score: v.current_score,
      target_score: v.target_score,
      exam_date: `${v.exam_year}-06-01`,
    });
    router.replace("/today");
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Расскажи о себе</h1>
      <p className="mt-2 text-sm text-muted">
        Это нужно, чтобы построить твой персональный план.
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-7">

        {/* Класс */}
        <div>
          <span className="mb-2 block text-sm font-medium">К чему готовишься</span>
          <div className="grid grid-cols-2 gap-3">
            {GRADES.map((g) => {
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
                  <div className={cn("text-sm", active ? "text-bg/70" : "text-muted")}>
                    {g.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Текущий уровень */}
        <Controller
          control={form.control}
          name="current_score"
          render={({ field }) => (
            <div>
              <span className="mb-2 block text-sm font-medium">
                {isOge ? "Какая оценка сейчас?" : "Какой балл сейчас (примерно)?"}
              </span>
              {isOge ? (
                <ScoreButtons value={field.value} onChange={field.onChange} options={OGE_SCORES} />
              ) : (
                <ScoreButtons
                  value={field.value}
                  onChange={field.onChange}
                  options={egeScoreOptions}
                />
              )}
            </div>
          )}
        />

        {/* Цель */}
        <Controller
          control={form.control}
          name="target_score"
          render={({ field }) => (
            <div>
              <span className="mb-2 block text-sm font-medium">
                {isOge ? "Какую оценку хочешь получить?" : "Какой балл хочешь набрать?"}
              </span>
              {isOge ? (
                <ScoreButtons value={field.value} onChange={field.onChange} options={OGE_SCORES} />
              ) : (
                <ScoreButtons
                  value={field.value}
                  onChange={field.onChange}
                  options={egeTargetOptions}
                />
              )}
            </div>
          )}
        />

        {/* Год экзамена */}
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
          {mutation.isPending ? "Сохраняем..." : "Продолжить"}
        </Button>
      </form>
    </main>
  );
}
