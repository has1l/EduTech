export interface KBItem {
  taskId: string;
  topicId: string;
  solvedAt: number;
}

const KEY = "kb_v1";

const LEVELS = [
  { min: 0,   name: "Новичок",  emoji: "🌱", nextAt: 10  },
  { min: 10,  name: "Ученик",   emoji: "📖", nextAt: 25  },
  { min: 25,  name: "Знаток",   emoji: "🎯", nextAt: 50  },
  { min: 50,  name: "Мастер",   emoji: "⚡", nextAt: 100 },
  { min: 100, name: "Эксперт",  emoji: "🏆", nextAt: Infinity },
];

export function getKB(): KBItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as KBItem[]) : [];
  } catch {
    return [];
  }
}

export function addToKB(taskId: string, topicId: string) {
  const items = getKB();
  if (items.some((i) => i.taskId === taskId)) return;
  items.push({ taskId, topicId, solvedAt: Date.now() });
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function getKBCount(): number {
  return getKB().length;
}

export function getKBTaskIds(limit = 20): string[] {
  const items = [...getKB()].sort(() => Math.random() - 0.5);
  return items.slice(0, limit).map((i) => i.taskId);
}

export function clearKB() {
  localStorage.removeItem(KEY);
}

export function getKBLevel() {
  const count = getKBCount();
  const level = [...LEVELS].reverse().find((l) => count >= l.min) ?? LEVELS[0];
  return { ...level, count };
}
