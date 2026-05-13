import { AppNav } from "@/components/app-nav";

export default function TheoryPage() {
  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold tracking-tight">Теория</h1>
        <p className="mt-2 text-sm text-muted">
          Подключим, когда в БД появятся theory_sections.
        </p>
      </main>
    </>
  );
}
