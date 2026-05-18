<div align="center">

# 🎓 EduTech Solutions

### AI-ассистент для подготовки к ОГЭ и ЕГЭ по математике

**Сократический AI-тьютор, который не выдаёт ответ — а помогает найти его самостоятельно**

[![Backend](https://img.shields.io/badge/backend-FastAPI%200.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Web](https://img.shields.io/badge/web-Next.js%2014-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Android](https://img.shields.io/badge/android-Jetpack%20Compose-3DDC84?style=flat-square&logo=android)](https://developer.android.com/compose)
[![iOS](https://img.shields.io/badge/iOS-SwiftUI-000000?style=flat-square&logo=swift)](https://developer.apple.com/swiftui/)
[![Python](https://img.shields.io/badge/python-3.12-3776AB?style=flat-square&logo=python)](https://python.org)
[![PostgreSQL](https://img.shields.io/badge/postgres-16+pgvector-336791?style=flat-square&logo=postgresql)](https://postgresql.org)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![Hackathon](https://img.shields.io/badge/hackathon-Т--Образование%202026-FFD000?style=flat-square)](https://t.me/tbank)

</div>

---

## Содержание

- [О проекте](#-о-проекте)
- [Ключевые отличия от конкурентов](#-ключевые-отличия-от-конкурентов)
- [Функциональность](#-функциональность)
- [Архитектура](#-архитектура)
- [Технологический стек](#-технологический-стек)
- [Быстрый старт](#-быстрый-старт)
- [Переменные окружения](#-переменные-окружения)
- [Структура репозитория](#-структура-репозитория)
- [Разработка по платформам](#-разработка-по-платформам)
- [API Reference](#-api-reference)
- [База данных](#-база-данных)
- [Деплой](#-деплой)
- [Тестирование](#-тестирование)
- [Архитектурные решения](#-архитектурные-решения)
- [Безопасность](#-безопасность)
- [Стоимость инфраструктуры](#-стоимость-инфраструктуры)
- [Roadmap](#-roadmap)
- [Команда](#-команда)

---

## 🎯 О проекте

EduTech Solutions — это AI-ассистент для подготовки школьников 8–11 классов к ОГЭ и ЕГЭ по математике. Не просто банк задач, а **сократический тьютор**: вместо того чтобы сразу показать решение, AI задаёт точный вопрос про конкретный шаг, где ученик ошибся, и ведёт его к правильному ответу через диалог.

### Боли, которые мы закрываем

| # | Боль | Решение |
|---|---|---|
| 1 | «С чего начать?» | Адаптивная диагностика — 20 заданий, карта знаний по темам |
| 2 | «Почему я ошибся?» | Сократический диалог вместо «✗ неверно» |
| 3 | «Репетитор дорогой» | AI-тьютор 24/7 без ограничений, 1500–3500 ₽/час → ~$0 |
| 4 | «Не вижу прогресса» | Стрик, прогноз балла, визуальная карта знаний |

> **Главный конкурент — Т-Число (T-Bank).** Имеет курсы и задания, но после ответа сразу показывает решение. Нет AI-объяснений, нет персональной траектории, нет геймификации. **Наш продукт — это Т-Число с мозгом.**

---

## 🏆 Ключевые отличия от конкурентов

```
Т-Число:                          EduTech Solutions:
┌─────────────────────┐           ┌─────────────────────────────────────┐
│  Задание            │           │  Задание                            │
│  ┌───────────────┐  │           │  ┌───────────────┐                  │
│  │ Реши:         │  │           │  │ Реши:         │                  │
│  │ x² + 5x = 0  │  │           │  │ x² + 5x = 0  │                  │
│  └───────────────┘  │           │  └───────────────┘                  │
│                     │           │                                     │
│  Ответ: ???         │           │  Ты ответил: x = 5                  │
│  [Открыть теорию]   │           │                                     │
│         ↓           │           │  🤖 AI-тьютор:                      │
│  ✗ Неверно          │           │  «Подставь x=5 в исходное           │
│  [Решение: ...]     │           │   уравнение. Что получается?»       │
└─────────────────────┘           │         ↓                           │
                                  │  «А что нужно было получить?»       │
                                  │         ↓                           │
                                  │  [📖 Формулы квадратных уравнений]  │
                                  └─────────────────────────────────────┘
```

**Динамическая теория:** AI возвращает `theory_ref` — какой раздел теории показать **на этом конкретном шаге** диалога, исходя из типа ошибки. У Т-Числа кнопка «Открыть теорию» статичная (всегда одна). У нас — динамическая.

---

## ✨ Функциональность

### Функция 1 — Онбординг и диагностика
- Выбор класса (9/11), целевого балла, даты экзамена
- Адаптивная диагностика ~20 заданий, 15–20 минут
- Карта знаний: красное / жёлтое / зелёное по темам (Bayesian Knowledge Tracing)
- Прогноз балла — «если ничего не делать» и «если заниматься по плану»

### Функция 2 — Ежедневная сессия
- 5–15 минут, 3–5 заданий в день
- Подбираются по слабым темам + FSRS (spaced repetition)
- Математика ОГЭ (задания 6–19) и ЕГЭ Часть 1 (77 подтем)

### Функция 3 — AI-объяснение ошибки (ядро продукта)
1. Пользователь выбирает неверный вариант
2. AI анализирует тип ошибки на основе выбранного варианта
3. Задаёт **один** точный вопрос про шаг с ошибкой
4. Ведёт по логике через 1–3 хода диалога
5. Hint level: `1` — наводящий вопрос → `2` — подсказка → `3` — полное объяснение
6. Закрепляющее задание того же типа

### Функция 4 — Прогресс и мотивация
- Streak (ежедневная серия) + Streak Freeze
- Зигзаг-путь по заданиям с узлами прогресса
- AI-генерированный план обучения по слабым темам
- Бустер — персональный список сложных задач для повтора
- База знаний — сохранённые теоретические разделы

### Функция 5 — Push-уведомления
- Локальное напоминание в настраиваемое время
- «Твой streak под угрозой 🔥»

---

## 🏗 Архитектура

```
┌────────────────────────────────────────────────────────────────┐
│                      КЛИЕНТСКИЙ СЛОЙ                           │
├───────────────┬──────────────────┬─────────────────────────────┤
│ Web (Next.js) │   iOS (SwiftUI)  │   Android (Jetpack Compose) │
│   на Vercel   │   TestFlight     │   Google Play               │
└──────┬────────┴────────┬─────────┴──────────────┬──────────────┘
       │                 │                         │
       │         HTTPS (REST + SSE)               │
       └─────────────────┼─────────────────────────┘
                         ▼
         ┌──────────────────────────────────┐
         │     Backend API — Railway         │
         │     Python 3.12 + FastAPI 0.115   │
         │     REST + Server-Sent Events     │
         └──┬──────┬──────────┬─────────┬───┘
            │      │          │         │
     ┌──────▼┐  ┌──▼──┐  ┌───▼───┐ ┌───▼──────┐
     │Postgres│  │Redis│  │ ARQ   │ │OpenAI    │
     │16 +    │  │  7  │  │worker │ │GPT-4o    │
     │pgvector│  │     │  │       │ │          │
     └────────┘  └─────┘  └───────┘ └──────────┘
```

**Принципы:**
- **Один API на все платформы.** Web, iOS, Android используют одни и те же эндпоинты. Вся бизнес-логика на бэкенде.
- **API-first.** Бэкенд первичен. Клиенты добавляются по очереди: Web → iOS → Android.
- **SSE для AI.** Бэкенд стримит ответ GPT-4o в реальном времени — пользователь видит как AI «печатает».
- **Российская аудитория.** Яндекс ID вместо Google. Хостинг Railway/Vercel приемлем для MVP.

### Ключевые сценарии

<details>
<summary><b>Сценарий 1 — Авторизация</b></summary>

```
Email/Password:
  POST /auth/register { email, password }
  POST /auth/login    { email, password }
  → JWT access (TTL 15 мин) + refresh (TTL 30 дней)
  → Хранение: cookie (web) / EncryptedSharedPreferences (Android) / Keychain (iOS)

Яндекс ID:
  Клиент → Яндекс OAuth → code
  POST /auth/yandex { code, redirect_uri }
  API → exchange code → Яндекс access_token
  API → GET https://login.yandex.ru/info → { id, email, name }
  API → upsert user by yandex_id → выдать наш JWT
```
</details>

<details>
<summary><b>Сценарий 2 — Адаптивная диагностика</b></summary>

```
POST /diagnostic/start
  → создаёт сессию, первое задание средней сложности

POST /diagnostic/submit { session_id, answers[] }
  → Bayesian Knowledge Tracing по каждой теме
  → сохраняет mastery по 14–77 подтемам
  → вычисляет currentScore, обновляет user.diagnosticCompletedAt

GET /diagnostic/result
  → карта знаний (red/yellow/green по темам) + прогноз балла
```
</details>

<details>
<summary><b>Сценарий 3 — Сократический диалог (SSE)</b></summary>

```
Пользователь ответил неверно:
  POST /tasks/{id}/answer { answer }
  → { correct: false, dialogue_id: "abc-123" }

GET /dialogue/abc-123/stream   (Server-Sent Events)
  event: token   data: "Подставь"
  event: token   data: " x=5"
  event: token   data: " в исходное уравнение."
  event: meta    data: {"theory_ref": {"title": "Квадратные уравнения", "section_id": 42}}
  event: done

  Клиент видит ответ AI как печатается + динамическую кнопку «Открыть теорию»

POST /dialogue/abc-123/reply { text: "получается 30" }
  → новый SSE stream

  После 3 ходов или resolved=true → закрепляющая задача
```
</details>

<details>
<summary><b>Сценарий 4 — Стрик</b></summary>

```
Завершение сессии → POST /streak/record (идемпотентно)
Пропустил день   → Streak Freeze применяется автоматически (если есть)
                   Иначе → streak = 0
Каждый вечер     → локальный push если не было сессии:
                   «Твоя серия 12 дней под угрозой 🔥»
```
</details>

---

## 🛠 Технологический стек

### Backend

| Компонент | Технология | Версия |
|---|---|---|
| Framework | FastAPI | 0.115.0 |
| Runtime | Python | 3.12 |
| ASGI Server | Uvicorn | 0.32.0 |
| ORM | SQLAlchemy (async) | 2.0.35 |
| DB Driver | asyncpg | 0.29.0 |
| Migrations | Alembic | 1.13.3 |
| Validation | Pydantic v2 | 2.9.2 |
| Cache / Queue | Redis | 7 |
| Background jobs | ARQ | 0.26.1 |
| HTTP Client | httpx | 0.27.2 |
| SSE | sse-starlette | 2.1.3 |
| JWT | python-jose | 3.3.0 |
| Passwords | bcrypt | 4.2.0 |
| AI | OpenAI SDK | 1.51.0 |
| Token counting | tiktoken | 0.8.0 |
| Monitoring | Sentry | 2.15.0 |

### Database

| Компонент | Технология | Версия |
|---|---|---|
| Primary DB | PostgreSQL | 16 |
| Vector search | pgvector | 0.3.5 |
| Cache / Sessions | Redis | 7-alpine |

### Web

| Компонент | Технология | Версия |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.35 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | 3.4 |
| UI Components | shadcn/ui | latest |
| Data Fetching | TanStack Query | 5.100 |
| State | Zustand | 5.0 |
| Forms | React Hook Form + Zod | 7.75 / 4.4 |
| Math Rendering | KaTeX | 0.16 |
| SSE | eventsource-parser | 3.0 |
| HTTP Client | Axios | 1.16 |

### Android

| Компонент | Технология | Версия |
|---|---|---|
| Language | Kotlin | 2.0.21 |
| UI | Jetpack Compose BOM | 2024.09.00 |
| Navigation | Navigation Compose | 2.8.9 |
| HTTP | Retrofit + OkHttp | 2.11.0 / 4.12.0 |
| Images | Coil | 2.7.0 |
| Security | EncryptedSharedPreferences | 1.1.0-alpha06 |
| Async | Kotlin Coroutines | 1.9.0 |
| Math Rendering | KaTeX 0.16 (WebView, bundled) | — |
| Min SDK | Android 9 | API 28 |
| Target SDK | Android 16 | API 36 |

### iOS

| Компонент | Технология |
|---|---|
| Language | Swift 5.10 |
| UI | SwiftUI |
| Networking | URLSession + async/await |
| Security | Keychain Services |
| SSE | Custom SSEClient (AsyncThrowingStream) |
| Math | KaTeX 0.16 (WKWebView, bundled) |
| Mascot | AVPlayer (MP4 looping) |
| Min Target | iOS 15 |

### Инфраструктура

| Компонент | Сервис |
|---|---|
| Backend hosting | Railway.app |
| Web hosting | Vercel |
| iOS distribution | TestFlight |
| CI/CD | GitHub Actions |
| Monitoring | Sentry |

---

## 🚀 Быстрый старт

### Требования

- Docker 24+ и Docker Compose v2
- Node.js 20+ и pnpm 9+
- Python 3.12+
- Android Studio Hedgehog+ (для Android)
- Xcode 16+ (для iOS, только macOS)

### 1. Клонировать репозиторий

```bash
git clone https://github.com/has1l/EduTech.git
cd EduTech
```

### 2. Настроить переменные окружения

```bash
cp backend/.env.example backend/.env
cp web/.env.example web/.env.local
```

Отредактируйте `backend/.env` — минимально необходимо указать `OPENAI_API_KEY`.

### 3. Запустить инфраструктуру (PostgreSQL + Redis)

```bash
docker compose up -d postgres redis
```

### 4. Запустить backend

```bash
cd backend

# Создать и активировать виртуальное окружение
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate

# Установить зависимости
pip install -r requirements.txt

# Применить миграции и загрузить тестовые данные
alembic upgrade head
python scripts/seed.py

# Запустить сервер с hot-reload
uvicorn app.main:app --reload --port 8000
```

API доступен на `http://localhost:8000`.
Документация (Swagger): `http://localhost:8000/docs`.

### 5. Запустить веб-приложение

```bash
cd web
pnpm install
pnpm dev
```

Открыть `http://localhost:3000`.

### Полный стек одной командой

```bash
docker compose up --build
```

| Сервис | URL |
|---|---|
| Web (Next.js) | `http://localhost:3000` |
| API (FastAPI) | `http://localhost:8000` |
| Swagger UI | `http://localhost:8000/docs` |
| ReDoc | `http://localhost:8000/redoc` |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

---

## 🔧 Переменные окружения

### Backend (`backend/.env`)

| Переменная | Обязательно | Описание | Пример |
|---|---|---|---|
| `ENVIRONMENT` | ✅ | Окружение | `development` |
| `DATABASE_URL` | ✅ | PostgreSQL connection string | `postgresql+asyncpg://user:pass@localhost/edutech` |
| `REDIS_URL` | ✅ | Redis connection string | `redis://localhost:6379/0` |
| `JWT_SECRET` | ✅ | Секрет для JWT (мин. 64 символа) | `super-secret-64-char-string...` |
| `JWT_ALGORITHM` | ✅ | Алгоритм JWT | `HS256` |
| `ACCESS_TOKEN_TTL` | ✅ | TTL access token (сек) | `900` |
| `REFRESH_TOKEN_TTL` | ✅ | TTL refresh token (сек) | `2592000` |
| `OPENAI_API_KEY` | ✅ | OpenAI API ключ | `sk-...` |
| `YANDEX_CLIENT_ID` | — | Яндекс OAuth client ID | `abc123` |
| `YANDEX_CLIENT_SECRET` | — | Яндекс OAuth client secret | `secret` |
| `YANDEX_REDIRECT_URI_WEB` | — | Redirect URI для web | `http://localhost:3000/auth/yandex/callback` |
| `YANDEX_REDIRECT_URI_MOBILE` | — | Redirect URI для мобильных | `edutech://auth/yandex/callback` |
| `CORS_ORIGINS` | ✅ | Разрешённые CORS origins | `http://localhost:3000` |
| `SENTRY_DSN` | — | Sentry DSN (опционально) | `https://...@sentry.io/...` |

### Web (`web/.env.local`)

| Переменная | Обязательно | Описание | Пример |
|---|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Базовый URL API | `http://localhost:8000/api/v1` |
| `NEXT_PUBLIC_YANDEX_CLIENT_ID` | — | Яндекс OAuth client ID | `abc123` |
| `NEXT_PUBLIC_YANDEX_REDIRECT_URI` | — | Redirect URI для Яндекс OAuth | `http://localhost:3000/auth/yandex/callback` |

> ⚠️ **Никогда** не коммитьте `.env` файлы. `OPENAI_API_KEY` и `YANDEX_CLIENT_SECRET` должны быть **только на бэкенде** — никогда в `NEXT_PUBLIC_*` и никогда в мобильных клиентах.

---

## 📁 Структура репозитория

```
EduTech/                              # Монорепозиторий
├── backend/                          # Python FastAPI → Railway
│   ├── app/
│   │   ├── main.py                   # FastAPI app, lifespan, CORS
│   │   ├── config.py                 # Pydantic Settings
│   │   ├── api/v1/                   # REST эндпоинты
│   │   │   ├── auth.py               # Авторизация (email + Яндекс)
│   │   │   ├── users.py              # Профиль пользователя
│   │   │   ├── sessions.py           # Ежедневные сессии, путь
│   │   │   ├── tasks.py              # Задания, ответы, image proxy
│   │   │   ├── diagnostic.py         # Диагностика
│   │   │   ├── dialogue.py           # SSE-стриминг AI-диалога
│   │   │   ├── theory.py             # Теоретические разделы
│   │   │   ├── progress.py           # Карта знаний, прогноз балла
│   │   │   ├── streak.py             # Стрик, заморозки
│   │   │   ├── booster.py            # Бустер
│   │   │   ├── kb.py                 # База знаний
│   │   │   └── plan.py               # AI-план обучения
│   │   ├── models/                   # SQLAlchemy ORM модели
│   │   ├── schemas/                  # Pydantic DTO
│   │   ├── services/
│   │   │   ├── ai_service.py         # OpenAI GPT-4o (диалог, план, прогноз)
│   │   │   ├── auth_service.py       # JWT, bcrypt, Яндекс OAuth
│   │   │   ├── bank_ege_client.py    # Парсер bank-ege.ru (ЕГЭ + ОГЭ)
│   │   │   └── task_service.py       # FSRS, BKT, mastery
│   │   ├── core/
│   │   │   ├── db.py                 # SQLAlchemy async session
│   │   │   ├── redis.py              # Redis client
│   │   │   └── auth.py               # JWT зависимости FastAPI
│   │   └── workers/                  # ARQ фоновые задачи
│   ├── migrations/                   # Alembic (11 версий)
│   ├── tests/                        # pytest-asyncio тесты
│   ├── scripts/                      # seed.py и другие утилиты
│   ├── Dockerfile                    # Multi-stage Python 3.12
│   ├── requirements.txt
│   ├── pyproject.toml                # Ruff, Mypy, Pytest конфиг
│   └── railway.toml                  # Railway деплой конфиг
│
├── web/                              # Next.js 14 → Vercel
│   ├── src/app/
│   │   ├── gate/                     # Роутинг после загрузки
│   │   ├── (auth)/                   # login, register
│   │   ├── auth/yandex/callback/     # OAuth callback
│   │   └── (app)/
│   │       ├── today/                # Дашборд дня
│   │       ├── session/              # Зигзаг-путь / AI-план
│   │       ├── task/[id]/            # Решение задачи + AI-диалог
│   │       ├── booster/              # Бустер
│   │       ├── diagnostic/           # Диагностика + результат
│   │       ├── progress/             # Прогресс, карта знаний, KB
│   │       ├── profile/              # Профиль
│   │       └── onboarding/           # Онбординг
│   ├── src/components/               # UI компоненты
│   ├── src/lib/                      # API клиент, хуки, типы
│   └── public/mascot/                # Анимации маскота (MP4)
│
├── app/                              # Android Kotlin + Compose
│   └── src/main/
│       ├── java/dev/squad52/android_edutech/
│       │   ├── core/
│       │   │   ├── network/          # ApiClient (Retrofit), SseClient (OkHttp+Flow)
│       │   │   ├── auth/             # EncryptedSharedPreferences
│       │   │   └── AppState.kt       # Глобальное состояние
│       │   ├── features/
│       │   │   ├── auth/             # LoginScreen, RegisterScreen
│       │   │   ├── onboarding/       # OnboardingScreen (3 шага)
│       │   │   ├── session/          # SessionPathScreen (зигзаг)
│       │   │   ├── task/             # TaskSessionScreen, DialogueScreen
│       │   │   ├── diagnostic/       # DiagnosticScreen
│       │   │   ├── booster/          # BoosterScreen
│       │   │   ├── progress/         # ProgressScreen
│       │   │   └── profile/          # ProfileScreen
│       │   ├── models/               # Data классы (Retrofit/GSON)
│       │   ├── nav/                  # Navigation Compose
│       │   └── ui/components/
│       │       └── MathText.kt       # KaTeX рендеринг через WebView
│       └── assets/katex/             # KaTeX 0.16.9 (23 файла, без CDN)
│
├── EduTech/                          # iOS Swift + SwiftUI
│   └── EduTech/
│       ├── App/                      # EduTechApp, AppState, Router, Config
│       ├── Core/
│       │   ├── Network/              # APIClient (actor), SSEClient
│       │   ├── Auth/                 # KeychainStore, TokenManager
│       │   └── Theme/                # Colors (appAccent = #FFD000)
│       ├── Features/                 # Экраны по фичам
│       ├── Models/                   # Codable structs (snake_case→camelCase)
│       ├── Shared/
│       │   └── MathText.swift        # KaTeX рендеринг через WKWebView
│       └── Resources/KaTeX/          # KaTeX 0.16.9 (локально)
│
├── docs/
│   └── ARCHITECTURE.md               # Детальная архитектура (36KB)
├── docker-compose.yml                # Локальная разработка
└── README.md
```

---

## 💻 Разработка по платформам

### Backend

```bash
cd backend
source .venv/bin/activate

# Запуск с hot-reload
uvicorn app.main:app --reload --port 8000

# ARQ worker (фоновые задачи)
arq app.workers.WorkerSettings

# Линтинг и типизация
ruff check . --fix
mypy app/

# Работа с миграциями
alembic revision --autogenerate -m "add_feature_x"
alembic upgrade head
alembic downgrade -1
```

**Как работает AI-сервис (`services/ai_service.py`):**
- `get_socratic_response()` — сократический диалог: GPT-4o с system-prompt, историей и типичными ошибками
- `generate_plan()` — AI-план по слабым темам (top-N по mastery < 0.5)
- `get_score_prediction()` — GPT-прогноз итогового балла с кешированием в Redis
- Rate limit: 10 AI-вызовов/мин на пользователя (sliding window в Redis)

**Источник задач (`services/bank_ege_client.py`):**
- ЕГЭ: 77 подтем (`ALL_EGE_SUBTOPICS`), задания 1–19
- ОГЭ: задания 6–19
- API: `new-api.bank-ege.ru`

### Web

```bash
cd web
pnpm dev          # localhost:3000
pnpm build        # production build
pnpm lint         # ESLint
```

**Ключевые реализации:**
- **SSE стриминг:** `eventsource-parser` + `ReadableStream` в `fetchEventStream()`, каждый токен аппендится в стейт
- **KaTeX:** `katex.renderToString()` прямо в React, опасный innerHTML (`dangerouslySetInnerHTML`)
- **Рисование:** canvas с поддержкой stroke (`pencil` / `eraser`) на странице задачи
- **Маскот:** `<video loop autoPlay muted>` с тремя состояниями: `idle`, `thinking`, `investigating`

### Android

```bash
# Сборка и проверка компиляции
./gradlew :app:compileDebugKotlin

# Debug APK
./gradlew :app:assembleDebug

# Установка на устройство
./gradlew :app:installDebug
```

**Ключевые реализации:**

**SSEClient (`core/network/SseClient.kt`):**
```kotlin
// Blocking OkHttp calls должны быть на IO dispatcher
fun stream(dialogueId: String): Flow<SseEvent> = flow {
    val response = client.newCall(request).execute()
    val source = response.body?.source()
    while (!source.exhausted()) {
        val line = source.readUtf8Line() ?: break
        // parse SSE...
    }
}.flowOn(Dispatchers.IO)  // критично: без этого NetworkOnMainThreadException
```

**MathText (`ui/components/MathText.kt`):**
- Проверяет наличие `\(` или `\[` → если нет, обычный `Text`
- Загружает KaTeX из `file:///android_asset/katex/` через `loadDataWithBaseURL`
- Измеряет высоту через `evaluateJavascript("document.body.scrollHeight")` в 150ms и 900ms после `onPageFinished`
- `scrollHeight` возвращает CSS px = dp (1:1). Делить на `displayMetrics.density` **не нужно**

**Архитектура:** MVVM, `ViewModel` + `StateFlow` + `collectAsState()`

**Известные особенности Material3 1.3.x:**
- `AssistChipDefaults.assistChipBorder()` удалён → использовать `BorderStroke` напрямую
- `OutlinedButtonDefaults` не существует → `ButtonDefaults.outlinedButtonColors()`
- `BorderStroke` — не data class, нет `.copy()`

### iOS

Открыть `EduTech/EduTech.xcodeproj` в Xcode 16+.

```
Выбрать схему EduTech и устройство/симулятор
Product → Run  (⌘R)
Product → Test (⌘U)
```

**Ключевые реализации:**
- **TaskSessionHost:** управляет сессией задач, навигацией между заданиями, состоянием диалога
- **SSEClient:** `URLSession.bytes(for:)` + `AsyncThrowingStream` для iOS-нативного SSE
- **MathText.swift:** `WKWebView` + KaTeX 0.16 (bundled). Высота через `evaluateJavaScript("document.body.scrollHeight")` с 200ms и 900ms задержками
- **Маскот:** `AVPlayer` с тремя MP4 (`idle.mp4`, `thinking.mp4`, `investigating.mp4`), переключение по состоянию диалога
- **OGE/EGE:** отдельные поля `diagnosticCompletedAt`/`ogeDiagnosticCompletedAt`, `currentScore`/`ogeCurrentScore`
- **Tokens:** JWT в Keychain (`kSecAttrAccessibleAfterFirstUnlock`)

---

## 📡 API Reference

Полная интерактивная документация: `/docs` (Swagger UI) и `/redoc` при запущенном сервере.

### Авторизация

| Метод | Endpoint | Описание |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Регистрация email/password |
| `POST` | `/api/v1/auth/login` | Вход email/password |
| `POST` | `/api/v1/auth/yandex` | OAuth через Яндекс ID |
| `POST` | `/api/v1/auth/refresh` | Обновление JWT |
| `POST` | `/api/v1/auth/logout` | Выход |

### Пользователь

| Метод | Endpoint | Описание |
|---|---|---|
| `GET` | `/api/v1/users/me` | Профиль текущего пользователя |
| `PATCH` | `/api/v1/users/me` | Обновление профиля |

### Задания и сессии

| Метод | Endpoint | Описание |
|---|---|---|
| `GET` | `/api/v1/sessions/today` | Задания на сегодня (FSRS + BKT) |
| `POST` | `/api/v1/sessions/{id}/complete` | Завершить сессию, записать стрик |
| `GET` | `/api/v1/sessions/path` | Зигзаг-путь (узлы прогресса) |
| `POST` | `/api/v1/sessions/reset-path` | Сбросить путь для повтора |
| `GET` | `/api/v1/tasks/{id}` | Получить задание |
| `POST` | `/api/v1/tasks/{id}/answer` | Отправить ответ → `{ correct, dialogue_id? }` |
| `GET` | `/api/v1/tasks/image-proxy` | Прокси картинок с bank-ege.ru |

### Диагностика

| Метод | Endpoint | Описание |
|---|---|---|
| `POST` | `/api/v1/diagnostic/start` | Начать диагностику |
| `POST` | `/api/v1/diagnostic/submit` | Отправить все ответы |
| `GET` | `/api/v1/diagnostic/result` | Карта знаний + прогноз балла |

### AI-диалог (SSE)

| Метод | Endpoint | Описание |
|---|---|---|
| `GET` | `/api/v1/dialogue/{id}/stream` | **SSE-стрим** ответа GPT-4o |
| `POST` | `/api/v1/dialogue/{id}/reply` | Отправить реплику в диалог |
| `POST` | `/api/v1/dialogue/{id}/give-up` | Запросить полное объяснение |

**Формат SSE-событий:**
```
event: token
data: "Подставь"

event: token
data: " x=5 в исходное уравнение."

event: meta
data: {"theory_ref": {"title": "Квадратные уравнения", "section_id": 42}}

event: done
data: ""

event: error
data: "rate_limit_exceeded"
```

### Прогресс и геймификация

| Метод | Endpoint | Описание |
|---|---|---|
| `GET` | `/api/v1/progress/map` | Mastery по всем темам (0.0–1.0) |
| `GET` | `/api/v1/progress/score-prediction` | GPT-прогноз балла (кешируется) |
| `GET` | `/api/v1/progress/timeline` | История прогресса |
| `GET` | `/api/v1/streak` | Стрик, рекорд, кол-во заморозок |
| `POST` | `/api/v1/streak/record` | Записать активность (идемпотентно) |
| `POST` | `/api/v1/streak/freeze` | Использовать streak freeze |
| `GET` | `/api/v1/booster` | Список задач в бустере |
| `POST` | `/api/v1/booster` | Добавить задачу в бустер |
| `DELETE` | `/api/v1/booster/{task_id}` | Убрать из бустера |
| `GET` | `/api/v1/kb/stats` | Уровень базы знаний |
| `POST` | `/api/v1/kb` | Добавить раздел теории в KB |
| `GET` | `/api/v1/plan` | Текущий план обучения |
| `POST` | `/api/v1/plan/generate` | Сгенерировать AI-план |

---

## 🗃 База данных

### Основные таблицы

```
users                             tasks
├── id (uuid, PK)                 ├── id (uuid, PK)
├── email (unique)                ├── topic_id (FK)
├── hashed_password               ├── exam_type (OGE/EGE)
├── yandex_id                     ├── question_text
├── name                          ├── question_image_url
├── grade (9 / 11)                ├── options (JSONB)
├── target_score                  ├── correct_answer
├── current_score                 ├── typical_errors (JSONB)
├── oge_current_score             └── difficulty (1–3)
├── exam_date
├── diagnostic_completed_at       theory_sections
└── oge_diagnostic_completed_at   ├── id
                                  ├── topic_id (FK)
topics                            ├── title
├── id                            ├── content_md
├── subject_id (FK)               └── embedding (vector(1536))
├── title
├── task_number                   ai_dialogues
├── subtopics (JSONB)             ├── id (uuid, PK)
└── order_index                   ├── user_id, task_id (FK)
                                  ├── messages (JSONB[])
user_topic_progress               ├── hint_level (1–3)
├── user_id, topic_id (FK)        ├── resolved (bool)
├── mastery (float 0.0–1.0)       └── theory_ref (JSONB)
├── attempts_count
└── last_seen_at                  streaks
                                  ├── user_id (FK, unique)
fsrs_cards                        ├── current_streak
├── user_id, task_id (FK)         ├── longest_streak
├── due_date                      ├── last_activity_date
├── stability                     └── freezes_available
└── difficulty
```

### Миграции

```bash
cd backend
source .venv/bin/activate

# Текущее состояние
alembic current

# Применить все
alembic upgrade head

# Откатить одну
alembic downgrade -1

# Создать новую
alembic revision --autogenerate -m "describe_change"
```

---

## 🚢 Деплой

### Backend → Railway

```bash
# Автоматически при push в main через railway.toml
# Ручной деплой:
railway up --service backend
```

**`railway.toml`:**
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "backend/Dockerfile"

[deploy]
startCommand = "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/health"
healthcheckTimeout = 30
```

**Railway addons:** PostgreSQL 16 (с pgvector через `CREATE EXTENSION vector`) + Redis 7.

### Web → Vercel

Push в `main` → автодеплой. Или вручную:

```bash
cd web
vercel --prod
```

**Environment Variables в Vercel Dashboard:**
```
NEXT_PUBLIC_API_URL      = https://your-backend.railway.app/api/v1
NEXT_PUBLIC_YANDEX_CLIENT_ID = ...
NEXT_PUBLIC_YANDEX_REDIRECT_URI = https://your-app.vercel.app/auth/yandex/callback
```

### Android → Google Play

```bash
# Release bundle для Google Play
./gradlew :app:bundleRelease

# Подписанный APK
./gradlew :app:assembleRelease \
  -Pkeystore.path=/path/to/release.jks \
  -Pkeystore.alias=edutech \
  -Pkeystore.password=YOUR_PASSWORD
```

### iOS → TestFlight

```
Xcode → Product → Archive
→ Distribute App
→ TestFlight & App Store
→ Upload
```

---

## 🧪 Тестирование

### Backend

```bash
cd backend
source .venv/bin/activate

# Все тесты
pytest

# С покрытием кода
pytest --cov=app --cov-report=html
open htmlcov/index.html

# Только определённые тесты
pytest tests/test_auth.py -v
pytest -k "diagnostic" -v
```

**Конфигурация (`pyproject.toml`):**
```toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
```

### Android

```bash
./gradlew :app:test                    # Unit тесты
./gradlew :app:connectedAndroidTest    # UI тесты (нужен эмулятор)
./gradlew :app:lint                    # Lint проверка
```

### Web

```bash
cd web
pnpm lint                    # ESLint
pnpm build                   # TypeScript проверка + production build
```

### Линтинг кода

```bash
# Python
ruff check backend/ --fix && mypy backend/app/

# TypeScript
cd web && pnpm lint

# Android Kotlin
./gradlew :app:lint
```

---

## 💡 Архитектурные решения

### Почему SSE, а не WebSocket?

AI-диалог — однонаправленный поток (сервер → клиент). SSE проще в реализации, работает через стандартный HTTP/1.1, не требует upgrade-хендшейка. `sse-starlette` идеально интегрируется с FastAPI async generators. WebSocket избыточен для этого сценария.

### Почему KaTeX bundled, а не CDN?

Мобильные приложения работают в условиях нестабильного интернета. KaTeX 0.16 (~2MB с шрифтами) встроен в Android assets и iOS bundle. Рендеринг формул происходит локально через WebView/WKWebView без внешних запросов.

### Почему Яндекс ID, а не Google?

Целевая аудитория — российские школьники (14–18 лет). Яндекс аккаунт есть у большинства, Google — не у всех (особенно в регионах, санкционные ограничения). Для продакшена 152-ФЗ потребует перехода на Yandex Cloud / VK Cloud.

### FSRS vs Anki SM-2

FSRS (Free Spaced Repetition Scheduler, v5) — алгоритм следующего поколения. Отдельно отслеживает **retrievability** (вероятность вспомнить) и **stability** (скорость забывания). Даёт более точные интервалы, особенно для коротких ежедневных сессий (5–15 минут). SM-2 оптимизирован под долгие сессии по типу Anki.

### Bayesian Knowledge Tracing vs простой счётчик

BKT оценивает скрытое состояние знания (mastered / not mastered) с учётом вероятности угадывания и случайных ошибок. Это важно для математики: пользователь может угадать правильный ответ, не зная тему, или ошибиться, зная её. Простой счётчик `correct/(correct+wrong)` не учитывает это.

---

## 🔒 Безопасность

| Аспект | Реализация |
|---|---|
| HTTPS | Railway и Vercel предоставляют из коробки |
| JWT | access 15 мин + refresh 30 дней в Redis |
| Пароли | bcrypt (cost factor 12) |
| Rate limiting | Redis sliding window: 10 AI-вызовов/мин на пользователя |
| CORS | Белый список доменов в settings |
| Секреты | OpenAI и Yandex keys только на бэкенде, никогда на клиентах |
| Валидация | Pydantic v2 на всех входящих данных |
| CSRF | Yandex OAuth state parameter |
| Android storage | EncryptedSharedPreferences (AES-256-GCM + RSA-OAEP) |
| iOS storage | Keychain (kSecAttrAccessibleAfterFirstUnlock) |
| SQL | Только parameterized queries через SQLAlchemy ORM |

---

## 💰 Стоимость инфраструктуры

| Сервис | Стоимость |
|---|---|
| Railway Hobby | $5/мес кредит (фактически бесплатно) |
| Vercel | Бесплатный план |
| OpenAI GPT-4o | ~$10–15 на всё MVP-тестирование |
| GitHub | Бесплатно |
| Sentry free tier | Бесплатно |
| **Итого** | **~$10–15** |

---

## 🗺 Roadmap

**Реализовано в MVP:**
- [x] Email/password + Яндекс ID авторизация
- [x] Адаптивная диагностика (BKT)
- [x] Ежедневные сессии (FSRS spaced repetition)
- [x] AI сократический диалог (GPT-4o, SSE-стриминг)
- [x] Зигзаг-путь с узлами прогресса
- [x] AI-план обучения по слабым темам
- [x] Стрик + Streak Freeze
- [x] Бустер задач + База знаний
- [x] Прогноз балла (GPT)
- [x] Web-приложение (Next.js 14)
- [x] iOS-приложение (SwiftUI)
- [x] Android-приложение (Jetpack Compose)
- [x] KaTeX рендеринг формул на всех платформах
- [x] OGE/EGE раздельные профили и диагностики

**Следующие шаги:**
- [ ] Push-уведомления (FCM / APNs)
- [ ] Еженедельный мини-вариант ОГЭ/ЕГЭ
- [ ] Часть 2 (развёрнутые ответы + проверка GPT-4o Vision)
- [ ] Фото задачи (OCR / Photomath-стиль)
- [ ] Другие предметы (физика, русский язык)
- [ ] Лиги и соревнования между пользователями
- [ ] Офлайн-режим для мобильных
- [ ] Перенос инфраструктуры на Yandex Cloud (152-ФЗ)

---

## 👤 Команда

| Имя | Роль |
|---|---|
| **Родион** | Fullstack: Backend (FastAPI), Web (Next.js), iOS (SwiftUI), Android (Jetpack Compose) |

Проект создан в рамках хакатона **Т-Образование 2026** от Т-Банка.

---

## 📄 Лицензия

Этот проект распространяется под лицензией MIT. Подробности — в файле [LICENSE](LICENSE).

---

<div align="center">

Сделано с ❤️ для школьников, которые готовятся к ОГЭ и ЕГЭ

**[Документация](docs/ARCHITECTURE.md)** · **[API Docs](http://localhost:8000/docs)** · **[Issues](https://github.com/has1l/EduTech/issues)**

</div>
