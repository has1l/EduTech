"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
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
  target_score: z
    .number({ error: "Введи число" })
    .int()
    .min(40, "Не меньше 40")
    .max(100, "Не больше 100"),
  exam_date: z.string().min(1, "Выбери дату"),
});

type FormValues = z.infer<typeof schema>;

const GRADES = [
  { value: 9, label: "9 класс", subtitle: "ОГЭ" },
  { value: 11, label: "11 класс", subtitle: "ЕГЭ" },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const mutation = useUpdateProfile();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { grade: 11, target_score: 80, exam_date: "" },
  });

  const grade = form.watch("grade");

  const onSubmit = form.handleSubmit(async (v) => {
    await mutation.mutateAsync(v);
    router.replace("/today");
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Расскажи о себе</h1>
      <p className="mt-2 text-sm text-muted">
        Это нужно, чтобы построить твой персональный план.
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">
        <div>
          <span className="mb-2 block text-sm font-medium">К чему готовишься</span>
          <div className="grid grid-cols-2 gap-3">
            {GRADES.map((g) => {
              const active = grade === g.value;
              return (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => form.setValue("grade", g.value)}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
                    active
                      ? "border-fg bg-fg text-bg"
                      : "border-border hover:bg-fg/5",
                  )}
                >
                  <div className="text-lg font-semibold">{g.label}</div>
                  <div
                    className={cn(
                      "text-sm",
                      active ? "text-bg/70" : "text-muted",
                    )}
                  >
                    {g.subtitle}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Field
          label="Целевой балл"
          error={form.formState.errors.target_score?.message}
        >
          <Input
            type="number"
            min={40}
            max={100}
            inputMode="numeric"
            {...form.register("target_score", { valueAsNumber: true })}
          />
        </Field>

        <Field
          label="Дата экзамена"
          error={form.formState.errors.exam_date?.message}
        >
          <Input type="date" {...form.register("exam_date")} />
        </Field>

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
