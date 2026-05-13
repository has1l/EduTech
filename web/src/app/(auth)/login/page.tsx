"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { YandexLoginButton } from "@/components/yandex-login-button";
import { apiErrorMessage, useAuthMutation } from "@/lib/auth-flow";

const schema = z.object({
  email: z.email("Некорректный email"),
  password: z.string().min(1, "Введи пароль"),
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });
  const mutation = useAuthMutation("login");

  const onSubmit = form.handleSubmit((v) => mutation.mutate(v));

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Вход</h1>
      <p className="mt-2 text-sm text-muted">
        Нет аккаунта?{" "}
        <Link href="/register" className="font-medium underline">
          Зарегистрироваться
        </Link>
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
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
            autoComplete="current-password"
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
          {mutation.isPending ? "Входим..." : "Войти"}
        </Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-border" />
        <span>или</span>
        <div className="h-px flex-1 bg-border" />
      </div>
      <YandexLoginButton />
    </>
  );
}
