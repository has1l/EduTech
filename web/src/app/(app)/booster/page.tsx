"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Zap, SkipForward, Sparkles } from "lucide-react";
import { AppNav } from "@/components/app-nav";
import { getBooster, removeFromBooster, type BoosterItem } from "@/lib/booster";
import { cn } from "@/lib/utils";

function TaskCard({ item, onRemove }: { item: BoosterItem; onRemove: () => void }) {
  const router = useRouter();
  const isSkipped = item.reason === "skipped";

  function practice() {
    router.push(`/task/${item.taskId}?booster=1`);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            isSkipped ? "bg-danger/15" : "bg-accent/15",
          )}
        >
          {isSkipped ? (
            <SkipForward className="h-4 w-4 text-danger" />
          ) : (
            <Sparkles className="h-4 w-4 text-accent" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <span
            className={cn(
              "text-xs font-medium rounded-full px-2 py-0.5",
              isSkipped ? "bg-danger/10 text-danger" : "bg-accent/10 text-accent",
            )}
          >
            {isSkipped ? "Пропущено" : "Решено с AI"}
          </span>
          {item.questionPreview && (
            <p className="mt-1.5 text-sm text-muted leading-snug line-clamp-2">
              {item.questionPreview}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={practice}
          className="flex-1 rounded-xl bg-fg text-bg px-4 py-2.5 text-sm font-semibold hover:opacity-90 transition"
        >
          Разобрать
        </button>
        <button
          onClick={onRemove}
          className="rounded-xl border border-border px-4 py-2.5 text-sm text-muted hover:bg-fg/5 transition"
        >
          Удалить
        </button>
      </div>
    </div>
  );
}

export default function BoosterPage() {
  const [items, setItems] = useState<BoosterItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setItems(getBooster());
    setLoaded(true);
  }, []);

  function remove(taskId: string) {
    removeFromBooster(taskId);
    setItems((prev) => prev.filter((i) => i.taskId !== taskId));
  }

  const skipped = items.filter((i) => i.reason === "skipped");
  const ai = items.filter((i) => i.reason === "ai");

  return (
    <>
      <AppNav />
      <main className="mx-auto max-w-md px-6 py-10 space-y-8">
        <div className="flex items-center gap-3">
          <Link href="/today" className="text-muted hover:text-fg transition">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Zap className="h-6 w-6 text-accent" />
              Бустер
            </h1>
            <p className="text-sm text-muted">Задания для повторной отработки</p>
          </div>
        </div>

        {!loaded ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 rounded-2xl animate-pulse bg-fg/5" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
              <Zap className="h-8 w-8 text-success" />
            </div>
            <p className="text-lg font-semibold">Всё отработано!</p>
            <p className="text-sm text-muted">Здесь появятся задания, которые ты пропустил или решил с помощью AI.</p>
            <Link
              href="/session"
              className="mt-2 rounded-full bg-fg text-bg px-5 py-2.5 text-sm font-semibold hover:opacity-90 transition"
            >
              Продолжить учёбу →
            </Link>
          </div>
        ) : (
          <>
            {skipped.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
                  Пропущенные · {skipped.length}
                </h2>
                {skipped.map((item) => (
                  <TaskCard key={item.taskId} item={item} onRemove={() => remove(item.taskId)} />
                ))}
              </section>
            )}

            {ai.length > 0 && (
              <section className="space-y-3">
                <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
                  Решено с AI · {ai.length}
                </h2>
                {ai.map((item) => (
                  <TaskCard key={item.taskId} item={item} onRemove={() => remove(item.taskId)} />
                ))}
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
