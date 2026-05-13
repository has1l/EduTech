# EduTech — AI-ассистент для подготовки к ОГЭ/ЕГЭ

Сократический AI-тьютор для школьников 8-11 классов. Не выдаёт готовое решение, а ведёт по логике ошибки наводящими вопросами.

Кейс хакатона **Т-Образование**. Дедлайн: 18 мая 2026.

## Структура монорепо

```
.
├── backend/        FastAPI + PostgreSQL + Redis (Railway)
├── web/            Next.js 14 (Vercel)
├── EduTech/        iOS — Swift + SwiftUI
├── android/        Kotlin + Compose (если успеем)
├── docs/           ARCHITECTURE.md и прочая документация
└── CLAUDE.md       контекст проекта
```

## Запуск локально

Нужен Docker.

```bash
# поднять Postgres + Redis + backend
docker compose up

# применить миграции
docker compose exec api alembic upgrade head

# API будет на http://localhost:8000
# Swagger UI: http://localhost:8000/docs
```

## Документация

- [`CLAUDE.md`](./CLAUDE.md) — контекст проекта (что строим и зачем)
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — техническая архитектура

## Стек

**Backend:** Python 3.12, FastAPI, SQLAlchemy 2.0 async, PostgreSQL 16 + pgvector, Redis 7, ARQ, OpenAI GPT-4o

**Web:** Next.js 14, TypeScript, TailwindCSS, shadcn/ui, TanStack Query

**iOS:** Swift 5.10, SwiftUI

**Auth:** Яндекс ID (основной) + email/password
