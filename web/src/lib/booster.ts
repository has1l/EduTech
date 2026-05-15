export interface BoosterItem {
  taskId: string;
  topicId: string;
  reason: "skipped" | "ai";
  questionPreview: string;
  addedAt: number;
}

const KEY = "booster_v1";

export function getBooster(): BoosterItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BoosterItem[]) : [];
  } catch {
    return [];
  }
}

export function addToBooster(item: Omit<BoosterItem, "addedAt">) {
  const items = getBooster();
  if (items.some((i) => i.taskId === item.taskId)) return;
  items.unshift({ ...item, addedAt: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function removeFromBooster(taskId: string) {
  const items = getBooster().filter((i) => i.taskId !== taskId);
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function getBoosterCount(): number {
  return getBooster().length;
}
