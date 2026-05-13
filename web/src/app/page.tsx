import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-6 inline-flex items-center rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-fg">
        EduTech · MVP
      </div>
      <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight md:text-6xl">
        AI-репетитор, который не даёт списать.
      </h1>
      <p className="mt-5 max-w-xl text-balance text-base text-muted md:text-lg">
        Сократический тьютор по математике для ОГЭ и ЕГЭ. Ведёт за руку через
        твою ошибку — не показывает готовое решение.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/register"
          className="inline-flex h-12 items-center justify-center rounded-full bg-fg px-8 text-base font-semibold text-bg transition hover:opacity-90"
        >
          Начать
        </Link>
        <Link
          href="/login"
          className="inline-flex h-12 items-center justify-center rounded-full border border-border px-8 text-base font-semibold transition hover:bg-fg/5"
        >
          Войти
        </Link>
      </div>
    </main>
  );
}
