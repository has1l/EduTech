# Архитектура EduTech Solutions

> Документ описывает как устроен сервис изнутри: какие компоненты есть, как они общаются, как обрабатываются ключевые сценарии, как деплоится и масштабируется.

---

## 1. Архитектурные принципы

Прежде чем рисовать схемы — фиксируем правила, которыми руководствуемся при любом архитектурном решении.

### 1.1 API-first
Бэкенд — единственный источник истины. Web, iOS, Android идут через **одни и те же REST/SSE эндпоинты**. Бизнес-логика (BKT, FSRS, AI, расчёт прогресса) живёт ТОЛЬКО на бэкенде. Клиенты — это «тонкие» отрисовщики.

**Почему:** иначе при добавлении Android придётся переписать те же расчёты во второй раз, и они разойдутся.

### 1.2 Stateless backend
FastAPI инстансы не хранят пользовательскую сессию в памяти процесса. Всё состояние — в Postgres (долговременное) или Redis (быстрое/временное). Любой запрос может попасть в любой инстанс.

**Почему:** Railway может перезапустить контейнер в любой момент. И при росте нагрузки мы просто добавим второй инстанс — без переписывания.

### 1.3 Async везде где можно
SQLAlchemy async + asyncpg + httpx async. AI-вызов к OpenAI занимает 3-10 секунд — синхронный воркер на это время был бы заблокирован. Async корутины позволяют одному процессу держать сотни одновременных AI-стримов.

### 1.4 Streaming для AI
Сократический диалог стримится через **Server-Sent Events** — пользователь видит как AI «печатает», а не ждёт 8 секунд белого экрана. Это критично для UX образовательного продукта (вовлечение).

### 1.5 Тяжёлое — в фон
Расчёт прогноза балла, обновление embedding теории, отправка пушей — всё в **ARQ воркер** (asyncio-очередь на Redis). API-запросы не должны ждать.

### 1.6 Российский фокус
- Авторизация — Яндекс ID (главный путь), email/password как fallback
- Push iOS через APNs, Android через FCM (другого нет)
- Для production учитываем 152-ФЗ: персональные данные граждан РФ — на серверах в РФ. На MVP пока Railway, но при масштабировании переезд на Yandex Cloud / VK Cloud.

### 1.7 Один монорепозиторий
`backend/`, `web/`, `ios/`, `android/` — в одном git-репо. PR может затрагивать API и клиента одновременно. Дешёвый способ держать контракты синхронными.

---

## 2. Высокоуровневая схема

```
                    ┌──────────────────────────────────────┐
                    │           ПОЛЬЗОВАТЕЛИ                │
                    │   школьники 14-18 лет, 8-11 класс    │
                    └──────────────────────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            ▼                        ▼                        ▼
    ┌───────────────┐       ┌───────────────┐        ┌───────────────┐
    │  Web (Vercel) │       │  iOS (Native) │        │ Android (poss)│
    │  Next.js 14   │       │  Swift+SwiftUI│        │ Kotlin+Compose│
    │  TypeScript   │       │               │        │               │
    └───────┬───────┘       └───────┬───────┘        └───────┬───────┘
            │                       │                        │
            │       HTTPS (TLS 1.3)                          │
            │       JSON REST + SSE                          │
            └───────────────────────┼────────────────────────┘
                                    ▼
                    ┌────────────────────────────────┐
                    │   Backend API (Railway)         │
                    │   Python 3.12 + FastAPI         │
                    │   Uvicorn workers (async)       │
                    └──┬───────┬────────────┬────────┘
                       │       │            │
            ┌──────────┼───────┼────────────┼──────────────┐
            ▼          ▼       ▼            ▼              ▼
    ┌──────────────┐ ┌──────┐ ┌────────┐ ┌─────────┐ ┌──────────────┐
    │ PostgreSQL16 │ │Redis7│ │  ARQ   │ │ OpenAI  │ │ Яндекс OAuth │
    │ + pgvector   │ │      │ │workers │ │ GPT-4o  │ │     API      │
    │              │ │      │ │(asyncio│ │ + embed │ │              │
    │ — users      │ │— cache│ │ queue) │ │ ada-3   │ │              │
    │ — tasks      │ │— sess │ │        │ │         │ │              │
    │ — attempts   │ │— queue│ │— score │ │         │ │              │
    │ — dialogues  │ │— rate │ │— push  │ │         │ │              │
    │ — theory(vec)│ │— streak│ │— embed │ │         │ │              │
    │ — progress   │ │       │ │        │ │         │ │              │
    └──────────────┘ └──────┘ └────────┘ └─────────┘ └──────────────┘
                                    │
                                    ▼
                            ┌──────────────┐
                            │ APNs (iOS)   │
                            │ FCM (Android)│
                            └──────────────┘
```

---

## 3. Слои системы — что и зачем

### 3.1 Клиентский слой

| Платформа | Технологии | Что делает |
|---|---|---|
| **Web** (Vercel) | Next.js 14 App Router + TS + TanStack Query + Zustand + TailwindCSS + shadcn/ui + KaTeX | SSR-лендинг, дашборд, диалог с AI через `EventSource` API, рендер LaTeX-формул |
| **iOS** (нативное) | Swift 5.10 + SwiftUI + async/await + Keychain + SwiftMath | Тоже самое + push-уведомления через UNUserNotificationCenter, OAuth через `ASWebAuthenticationSession` |
| **Android** (если успеем) | Kotlin + Compose + Retrofit + OkHttp-EventSource + DataStore | Аналогично iOS, OAuth через AppAuth, push через FCM |

**Общие правила для всех клиентов:**
- Хранят только JWT и UI-state. Никакой бизнес-логики.
- Все формулы рендерятся библиотекой (KaTeX / iosMath) — бэкенд отдаёт LaTeX-строки.
- При expired access token — автоматический refresh через `/auth/refresh`. Если refresh тоже умер — редирект на логин.

### 3.2 API слой (Backend)

**FastAPI** на Railway. Один сервис, несколько роутеров:

```
app/api/v1/
  auth.py          — регистрация, login, Яндекс OAuth, refresh
  users.py         — профиль, настройки
  diagnostic.py    — старт/ответ/результат диагностики
  sessions.py      — ежедневная сессия (GET today, POST complete)
  tasks.py         — получение задачи, отправка ответа
  dialogue.py      — ⭐ SSE стрим AI-диалога, ответы юзера
  progress.py      — карта знаний, прогноз балла, timeline
  theory.py        — получение раздела теории
  streak.py        — streak статус, использование freeze
```

**Middleware (порядок):**
1. CORSMiddleware (белый список доменов: `edutech.app`, `localhost:3000`)
2. SentryASGIMiddleware (трекинг ошибок)
3. RequestIDMiddleware (X-Request-ID для трейсинга)
4. AuthMiddleware (валидация JWT, кладёт `request.state.user`)
5. RateLimitMiddleware (Redis-based, 100 req/min общий + 10/min на AI)

### 3.3 Слой бизнес-логики (services/)

Изолирует API от инфраструктуры. Сервисы не знают про FastAPI — это чистые Python-функции, которые работают с моделями SQLAlchemy.

```
services/
  ai_service.py
    ├─ build_socratic_prompt(task, attempt, dialogue_history) → str
    ├─ stream_dialogue_response(prompt) → AsyncGenerator[str]
    └─ parse_theory_ref(gpt_response) → TheoryRef

  yandex_auth_service.py
    ├─ exchange_code_for_token(code) → access_token
    ├─ fetch_user_info(access_token) → YandexUser
    └─ find_or_create_user(yandex_user) → User

  diagnostic_service.py
    ├─ start_session(user_id) → DiagnosticSession (в Redis)
    ├─ pick_next_task(session) → Task     # Bayesian item selection
    ├─ update_bkt(user_id, topic_id, correct) → MasteryUpdate
    └─ finalize_results(session) → KnowledgeMap + ScorePrediction

  fsrs_service.py
    ├─ schedule_next_review(card, rating) → datetime
    └─ get_due_cards(user_id, limit) → list[FSRSCard]

  progress_service.py
    ├─ predict_score(user_id, subject) → ScorePrediction
    ├─ get_knowledge_map(user_id) → list[TopicStatus]
    └─ rebuild_timeline(user_id) → list[TimelinePoint]

  streak_service.py
    ├─ on_session_complete(user_id) → StreakUpdate
    └─ check_streak_freeze(user_id) → bool
```

### 3.4 Слой данных (Postgres + Redis)

**Postgres** — всё, что должно пережить рестарт:
- Учётки, задачи, теория, попытки, диалоги, прогресс, FSRS-карточки, streaks
- Векторные эмбеддинги теории (pgvector)

**Redis** — всё быстрое и эфемерное:
- Сессии активной диагностики (`diag:{user_id}` → JSON состояние, TTL 30 мин)
- Refresh tokens (`refresh:{token_id}` → user_id, TTL 30 дней)
- Rate limit счётчики (`ratelimit:ai:{user_id}` → счётчик в минуту)
- Очереди ARQ (`arq:queue:default`)
- Кеш ленты задач на день (`today:{user_id}:{date}` → JSON, TTL до полуночи)

### 3.5 Слой фоновых задач (ARQ workers)

Отдельный процесс на Railway, читает очередь из Redis:

```
workers/
  push_notifications.py
    └─ send_streak_at_risk_push(user_id) — каждый день в 19:00

  embeddings.py
    └─ vectorize_theory_section(section_id) — после добавления теории

  analytics.py
    ├─ recompute_score_prediction(user_id) — раз в день, после сессии
    └─ rebuild_knowledge_map(user_id) — раз в день
```

ARQ умеет cron-задачи (`cron_jobs=[...]`), так что отдельный планировщик не нужен.

### 3.6 Внешние сервисы

| Сервис | Что от него нужно | Где ключ |
|---|---|---|
| **OpenAI** | GPT-4o (диалог), text-embedding-3-small (RAG теории) | `OPENAI_API_KEY`, только на бэкенде |
| **Яндекс OAuth** | Авторизация пользователей | `YANDEX_CLIENT_ID/SECRET` |
| **APNs** | Push на iOS | `.p8` ключ от Apple Developer |
| **FCM** | Push на Android | Service account JSON |
| **Sentry** | Трекинг ошибок | `SENTRY_DSN` |

---

## 4. Поток данных: ключевые сценарии

### 4.1 Регистрация через Яндекс ID

```
[Клиент]                [Backend]               [Яндекс OAuth]      [Postgres]
   │                        │                         │                  │
   │ открывает Яндекс OAuth│                         │                  │
   ├───────────────────────────────────────────────►  │                  │
   │                        │                         │                  │
   │ юзер логинится, redirect с ?code=XXX              │                  │
   │ ◄───────────────────────────────────────────────  │                  │
   │                        │                         │                  │
   │ POST /auth/yandex {code}│                        │                  │
   ├───────────────────────►│                         │                  │
   │                        │ POST /token {code}      │                  │
   │                        ├────────────────────────►│                  │
   │                        │ ◄ access_token          │                  │
   │                        │ GET /info {token}       │                  │
   │                        ├────────────────────────►│                  │
   │                        │ ◄ {id,email,name}       │                  │
   │                        │                         │                  │
   │                        │ SELECT * WHERE yandex_id=...               │
   │                        ├─────────────────────────────────────────────►
   │                        │ если нет — INSERT users  │                  │
   │                        ├─────────────────────────────────────────────►
   │                        │                                            │
   │                        │ generate JWT (access 15min + refresh 30d)  │
   │                        │                                            │
   │ ◄── {access, refresh, user, needs_onboarding: true} ──              │
   │                                                                     │
```

Ключевая защита: `state` параметр в OAuth (CSRF), сохраняем в cookie/Redis до callback.

### 4.2 Сократический диалог через SSE

Это **ядро продукта** — поэтому подробнее.

```
[Клиент]                    [Backend]              [Postgres]         [OpenAI]
   │                            │                       │                  │
   │ POST /tasks/{id}/answer    │                       │                  │
   │  {user_answer: "B"}        │                       │                  │
   ├───────────────────────────►│                       │                  │
   │                            │ SELECT task,          │                  │
   │                            │ correct_answer, ...   │                  │
   │                            ├──────────────────────►│                  │
   │                            │ ◄                     │                  │
   │                            │                       │                  │
   │                            │ is_correct = (user==correct)             │
   │                            │ INSERT attempts                          │
   │                            ├──────────────────────►│                  │
   │                            │                                          │
   │                            │ если is_correct:                         │
   │                            │   update BKT, FSRS                       │
   │                            │   return {next_task_id}                  │
   │                            │                                          │
   │                            │ если НЕ correct:                         │
   │                            │   INSERT ai_dialogues (attempt_id, ...)  │
   │                            │   return {dialogue_id}                   │
   │                            │                                          │
   │ ◄ {dialogue_id: "abc123"}  │                                          │
   │                            │                                          │
   │ GET /dialogue/abc123/stream│                                          │
   │   (Accept: text/event-stream)                                         │
   ├───────────────────────────►│                                          │
   │                            │ собирает контекст:                       │
   │                            │  — task.question_text                    │
   │                            │  — task.correct_answer                   │
   │                            │  — task.typical_errors[user_answer]      │
   │                            │  — dialogue.messages (история)           │
   │                            │                                          │
   │                            │ build_socratic_prompt(...)               │
   │                            │                                          │
   │                            │ POST /v1/chat/completions               │
   │                            │  stream=true, model=gpt-4o              │
   │                            ├─────────────────────────────────────────►│
   │                            │                                          │
   │                            │ ◄ chunk: "Давай"                        │
   │ ◄ event: token             │                                          │
   │   data: {"text":"Давай"}   │                                          │
   │                            │ ◄ chunk: " разберём"                    │
   │ ◄ event: token             │                                          │
   │   data: {"text":" разберём"}                                          │
   │                            │ ... (десятки chunks) ...                │
   │                            │                                          │
   │                            │ ◄ финальный chunk с JSON-tail:           │
   │                            │   {"theory_ref":{"title":"Вписанный угол"│
   │                            │    "section_id":"..."}}                  │
   │ ◄ event: theory_ref        │                                          │
   │   data: {"title":"...","id":"..."}                                    │
   │                            │                                          │
   │                            │ INSERT message в dialogue.messages       │
   │                            ├──────────────────────►│                  │
   │ ◄ event: done              │                                          │
   │                            │                                          │
   │ юзер отвечает              │                                          │
   │ POST /dialogue/abc123/reply{text:"я взял 1/2 угла"}                   │
   ├───────────────────────────►│                                          │
   │                            │ → новый SSE stream (то же самое заново) │
```

**Важные нюансы реализации SSE:**
- На бэкенде используем `sse-starlette`, который правильно ставит headers (`Cache-Control: no-cache`, `Connection: keep-alive`) и формат `event: ...\ndata: ...\n\n`
- Стрим OpenAI приходит чанками по 1-3 токена, мы их сразу пересылаем клиенту без буферизации
- Финальный JSON с `theory_ref` GPT возвращает в самом конце ответа. Бэкенд накапливает весь текст, после `[DONE]` парсит JSON, шлёт отдельным SSE-событием `theory_ref`, потом `done`.
- Если соединение оборвалось — диалог жив (в БД), при reconnect стрим продолжится с последнего сохранённого сообщения.

**Промпт-инженерия (фрагмент):**

```python
SYSTEM_PROMPT = """Ты педагог по математике.
Ученик решал задачу и ошибся.
ПРАВИЛА:
- НЕ давай правильный ответ
- Задай ОДИН конкретный вопрос про шаг с ошибкой
- После 2 вопросов — подсказка, но не ответ
- После 3 шагов — можешь объяснить полностью
- Тон: дружелюбный, не осуждающий

ФОРМАТ ОТВЕТА:
Сначала текст диалога (то что увидит ученик).
В конце на новой строке — JSON:
<<<THEORY>>>{"title":"...","section_id":"..."}<<<END>>>
"""

def build_socratic_prompt(task, attempt, history):
    typical_error = task.typical_errors.get(attempt.user_answer, {})
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"""
Задача: {task.question_text}
Правильный ответ: {task.correct_answer}
Ответ ученика: {attempt.user_answer}
Тип вероятной ошибки: {typical_error.get('description')}
Подсказка для тебя: {typical_error.get('hint_for_ai')}

История диалога:
{format_history(history)}

Сделай свой ход.
"""}
    ]
```

### 4.3 Адаптивная диагностика

```
POST /diagnostic/start
  ↓
[Backend]
  — создаёт DiagnosticSession в Redis (TTL 30 мин):
      {
        user_id,
        answered_tasks: [],
        topic_estimates: { topic_id: 0.5 }  # начальные априоры
      }
  — выбирает первое задание средней сложности по самой важной теме
  — возвращает task

POST /diagnostic/answer {task_id, answer}
  ↓
[Backend]
  — обновляет topic_estimates через BKT:
      P(mastery) = P(mastery|correct) или P(mastery|wrong)
  — если правильно → следующая тема ИЛИ сложнее в той же
  — если неправильно → пререквизит ИЛИ проще
  — повторяем до 20 заданий

POST /diagnostic/finalize
  ↓
[Backend]
  — переводит topic_estimates в красный/жёлтый/зелёный:
      < 0.4 → red
      0.4-0.7 → yellow
      > 0.7 → green
  — сохраняет в user_topic_progress
  — считает прогноз балла (вес темы × mastery)
  — возвращает KnowledgeMap + ScorePrediction
```

### 4.4 Ежедневная сессия

```
GET /sessions/today
  ↓
[Backend]
  1. кеш Redis: today:{user_id}:{YYYY-MM-DD}? — отдаём оттуда
  2. иначе подбираем задания:
       — 60% слабые темы (mastery < 0.5)
       — 30% FSRS due карточки (где stability подошла)
       — 10% повторение / закрепление
  3. 3-5 заданий, лимит времени 15 минут
  4. кешируем в Redis до полуночи

POST /sessions/{id}/complete
  ↓
[Backend]
  — обновляет streak (через streak_service)
  — ставит ARQ задачу recompute_score_prediction
```

### 4.5 Streak и push

```
[ARQ cron каждый день в 19:00]
  ↓
SELECT users WHERE last_session_date != today
  AND notifications_enabled = true
  ↓
для каждого:
  send_push_via_apns(
    title="Твоя серия 12 дней под угрозой 🔥",
    body="5 минут, и серия в безопасности"
  )

[Юзер открывает приложение и завершает сессию]
  ↓
streak_service.on_session_complete(user_id):
  if last_date == today - 1 day:
    streak += 1
  elif last_date < today - 1 and freezes > 0:
    freezes -= 1   # streak сохраняется
  elif last_date < today - 1:
    streak = 1     # сброс
  longest = max(longest, streak)
```

---

## 5. Деплой и инфраструктура

### 5.1 Топология окружений

| Окружение | Где | Когда деплоится |
|---|---|---|
| **local** | Docker Compose | разработка |
| **staging** | Railway (отдельный проект) | автодеплой при PR |
| **production** | Railway (главный) + Vercel prod | merge в `main` |

### 5.2 Backend на Railway

```
Railway project: edutech
├─ Service: api          (FastAPI, Uvicorn)
│   └─ ENV: DATABASE_URL, REDIS_URL, OPENAI_API_KEY, ...
│   └─ Health check: GET /health
│   └─ Port: $PORT (Railway автоматически)
│
├─ Service: worker       (ARQ воркеры)
│   └─ Команда: arq app.workers.WorkerSettings
│   └─ ENV: те же что у api
│
├─ Addon: PostgreSQL 16  (Railway managed)
│   └─ extension: CREATE EXTENSION vector;
│   └─ DATABASE_URL автоматически в env
│
└─ Addon: Redis 7        (Railway managed)
    └─ REDIS_URL автоматически в env
```

`railway.toml` в `backend/`:

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
restartPolicyType = "ON_FAILURE"
```

### 5.3 Web на Vercel

- Подключаем `web/` папку как корень проекта
- Framework preset: Next.js
- ENV: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_YANDEX_CLIENT_ID`
- Preview deployments автоматически на каждый PR

### 5.4 iOS

- Xcode проект в `ios/EduTech/`
- Конфиги в `Config.xcconfig`: `API_BASE_URL`, `YANDEX_CLIENT_ID`
- TestFlight для бета-тестирования
- В Info.plist: URL scheme `edutech` для OAuth callback

### 5.5 CI/CD

```
.github/workflows/
  backend.yml
    triggers: push to main, paths: backend/**
    jobs:
      - lint (ruff, mypy)
      - test (pytest)
      - deploy to Railway (railway up)

  web.yml
    triggers: push, paths: web/**
    jobs:
      - lint (eslint), type check (tsc)
      - test (vitest)
      - Vercel автоматически подхватывает

  ios.yml
    triggers: push tag v*, paths: ios/**
    jobs:
      - swift build, swiftlint
      - upload to TestFlight (fastlane)
```

---

## 6. Безопасность

### 6.1 Авторизация
- JWT access token: 15 минут, HS256, в header `Authorization: Bearer ...`
- Refresh token: 30 дней, хранится в Redis (`refresh:{jti}` → user_id), при logout удаляем
- Web: access в HttpOnly cookie + refresh в HttpOnly cookie (Secure, SameSite=Lax)
- iOS/Android: оба в Keychain / EncryptedSharedPreferences

### 6.2 OAuth Яндекс
- `state` параметр (UUID) сохраняем в Redis при инициации, проверяем при callback
- `code` обмениваем сразу, никогда не отдаём клиенту
- `client_secret` ТОЛЬКО на бэкенде

### 6.3 Пароли
- bcrypt cost factor 12 (passlib)
- Минимум 8 символов, проверка через haveibeenpwned не делаем (избыток для MVP)

### 6.4 Rate limiting (Redis)
- Общий: 100 req/min на JWT
- AI вызовы: 10/min на JWT (защита от ddos OpenAI ключа)
- Auth endpoints: 5/min на IP (защита от brute force)

### 6.5 CORS
Белый список:
```
edutech.app
www.edutech.app
edutech.vercel.app
localhost:3000 (только в dev)
```

### 6.6 OpenAI ключ
**НИКОГДА** не отдаём клиенту. Все запросы к GPT идут через наш бэкенд. Это и безопасность, и контроль (rate limit, логирование, биллинг).

### 6.7 Валидация входа
Все запросы — через Pydantic. SQL — только через SQLAlchemy ORM (никакого raw SQL с конкатенацией).

### 6.8 Sentry
DSN в env. Хуки автоматически захватывают unhandled exceptions, добавляем user.id в контекст для трейсинга.

---

## 7. Масштабирование (заглядываем вперёд)

На MVP — 100-1000 пользователей. Текущая архитектура держит легко. Но мысленно проектируем с заделом:

| Бутылочное горлышко | На MVP | Как решать при росте |
|---|---|---|
| FastAPI инстанс | 1 | Railway автоскейлинг (платный план) до N инстансов, без переписывания (stateless) |
| Postgres | 1 шт, до 1GB | Railway Pro → больше, потом переход на Yandex Cloud Managed Postgres + реплика чтения |
| Redis | 1 шт | Railway → Yandex Managed Redis Cluster |
| OpenAI стоимость | $10-15/мес | Кешировать частые диалоги (одна и та же ошибка в одной задаче → одинаковый prompt → можно кешировать первый ход в Redis) |
| Vercel | бесплатно | Pro план или собственный CDN |

**Key insight:** мы НЕ оптимизируем преждевременно. На MVP всё на одном Railway проекте. Но stateless backend + outsourced state позволяет масштабироваться без рефакторинга когда понадобится.

---

## 8. Что специально оставляем за бортом MVP

| Фича | Почему откладываем |
|---|---|
| OCR фото решения | OpenAI Vision + рукописная математика = низкая точность + дорого |
| Часть 2 ЕГЭ (развёрнутые) | Оценка развёрнутых решений — отдельный сложный AI-конвейер |
| Лиги/соцграф | Геймификация без вирального роста на MVP бессмысленна |
| Другие предметы | Каждый предмет = ~3 недели работы на контент. Математика — самый болезненный для школьников. |
| Webhook от Яндекс ID | Не нужен — pull модель достаточна |
| Реал-тайм синхронизация устройств | Cookie + Keychain хранят токены изолированно. Если юзер залогинен на двух устройствах — это ок. |

---

## 9. Контрольный чек-лист «архитектура готова»

- [ ] Postgres schema полностью описана в Alembic миграциях
- [ ] `/auth/yandex` работает end-to-end
- [ ] SSE стрим выдерживает обрыв соединения (тест: kill curl и reconnect)
- [ ] Rate limit на AI работает (тест: 11 запросов в минуту → 429)
- [ ] ARQ воркер деплоится отдельным сервисом
- [ ] CI пайплайны зелёные на main
- [ ] Sentry получает тестовое исключение
- [ ] Все секреты только в Railway/Vercel ENV (не в коде, не в git)

---

## 10. Дальше — порядок реализации

(см. CLAUDE.md §15, повторим кратко)

1. **Backend skeleton** — FastAPI hello world на Railway + Postgres + Redis
2. **Auth** — email/password + JWT, потом Яндекс ID
3. **DB schema + миграции** — все таблицы из §8 CLAUDE.md
4. **Данные** — 20-30 задач математики с typical_errors и теорией (загрузка через seed-скрипт)
5. **Tasks/Sessions API** — `/tasks/*`, `/sessions/today`
6. **AI dialogue SSE** — ядро, самое интересное
7. **Web MVP** — Next.js, ключевые экраны: login → onboarding → today → task → dialogue → progress
8. **iOS MVP** — те же экраны на SwiftUI
9. **Progress + Streak** — карта знаний, прогноз балла
10. **Диагностика** — упрощённый BKT
11. **Android** — если останется время

---

*Документ живой. Если архитектурное решение меняется — обновляем здесь, а не в чатах.*
