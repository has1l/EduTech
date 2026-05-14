"use client";

import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { apiErrorMessage } from "@/lib/api";
import { useUpdateProfile } from "@/lib/queries";
import { cn } from "@/lib/utils";

const schema = z.object({
  grade: z.union([z.literal(9), z.literal(11)]),
  target_score: z.number({ error: "Выбери значение" }).int().min(3).max(100),
  exam_year: z.number().int().min(2025).max(2030),
});

type FormValues = z.infer<typeof schema>;

const GRADES = [
  { value: 9, label: "9 класс", subtitle: "ОГЭ" },
  { value: 11, label: "11 класс", subtitle: "ЕГЭ" },
] as const;

const OGE_GRADES = [
  { value: 3, label: "3", sub: "Удовл." },
  { value: 4, label: "4", sub: "Хорошо" },
  { value: 5, label: "5", sub: "Отлично" },
] as const;

const currentYear = new Date().getFullYear();
const EXAM_YEARS = [currentYear, currentYear + 1, currentYear + 2];

export default function OnboardingPage() {
  const router = useRouter();
  const mutation = useUpdateProfile();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { grade: 11, target_score: 80, exam_year: currentYear },
  });

  const grade = form.watch("grade");
  const isOge = grade === 9;

  const onSubmit = form.handleSubmit(async (v) => {
    await mutation.mutateAsync({
      grade: v.grade,
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
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">

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
                  onClick={() => {
                    form.setValue("grade", g.value);
                    form.setValue("target_score", g.value === 9 ? 4 : 80);
                  }}
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

        {/* Целевая оценка / балл */}
        {isOge ? (
          <Controller
            control={form.control}
            name="target_score"
            render={({ field }) => (
              <div>
                <span className="mb-2 block text-sm font-medium">Целевая оценка</span>
                <div className="grid grid-cols-3 gap-3">
                  {OGE_GRADES.map((g) => {
                    const active = field.value === g.value;
                    return (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => field.onChange(g.value)}
                        className={cn(
                          "rounded-2xl border p-4 text-center transition",
                          active ? "border-fg bg-fg text-bg" : "border-border hover:bg-fg/5",
                        )}
                      >
                        <div className="text-2xl font-bold">{g.label}</div>
                        <div className={cn("text-xs mt-0.5", active ? "text-bg/70" : "text-muted")}>
                          {g.sub}
                        </div>
                      </button>
                    );
                  })}
                </div>
                {form.formState.errors.target_score && (
                  <p className="mt-1 text-xs text-danger">
                    {form.formState.errors.target_score.message}
                  </p>
                )}
              </div>
            )}
          />
        ) : (
          <Field
            label="Целевой балл"
            error={form.formState.errors.target_score?.message}
          >
            <Input
              type="number"
              min={40}
              max={100}
              inputMode="numeric"
              placeholder="40 – 100"
              {...form.register("target_score", { valueAsNumber: true })}
            />
          </Field>
        )}

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
