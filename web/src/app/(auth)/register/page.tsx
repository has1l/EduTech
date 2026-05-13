"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { apiErrorMessage, useAuthMutation } from "@/lib/auth-flow";

const schema = z.object({
  name: z.string().trim().min(1, "Как тебя зовут?"),
  email: z.email("Некорректный email"),
  password: z.string().min(8, "Минимум 8 символов"),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", password: "" },
  });
  const mutation = useAuthMutation("register");

  const onSubmit = form.handleSubmit((v) => mutation.mutate(v));

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Регистрация</h1>
      <p className="mt-2 text-sm text-muted">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="font-medium underline">
          Войти
        </Link>
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <Field label="Имя" error={form.formState.errors.name?.message}>
          <Input
            autoComplete="name"
            placeholder="Родион"
            {...form.register("name")}
          />
        </Field>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            {...form.register("email")}
          />
        </Field>
        <Field label="Пароль" error={form.formState.errors.password?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Минимум 8 символов"
            {...form.register("password")}
          />
        </Field>
        {mutation.error && (
          <p className="text-sm text-danger">{apiErrorMessage(mutation.error)}</p>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={mutation.isPending}
          className="mt-2"
        >
          {mutation.isPending ? "Создаём аккаунт..." : "Создать аккаунт"}
        </Button>
      </form>
    </>
  );
}
