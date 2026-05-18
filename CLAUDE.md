# EduTech Solutions — AI-ассистент для подготовки к ОГЭ/ЕГЭ

> **Подробная документация разнесена по папкам:**
> - `backend/CLAUDE.md` — БД, API endpoints, GPT-промпт, ENV, SSE+SQLAlchemy, bank-ege.ru, диалог, план, прогноз балла
> - `web/CLAUDE.md` — страница задачи, бустер, база знаний, прогресс, маскот, рисование, 3D-ноды, стрик
> - `EduTech/CLAUDE.md` — iOS: TaskSessionHost, путь, авторизация, диагностика, бустер, KaTeX, маскот
>
> **Куда сохранять новые знания:**
> Когда в разговоре появляются новые решения, баги, паттерны или важные решения — сохраняй их в CLAUDE.md той папки, к которой они относятся:
> - работаем с бэкендом → `backend/CLAUDE.md`
> - работаем с вебом → `web/CLAUDE.md`
> - работаем с iOS → `EduTech/CLAUDE.md`
> - что-то общее для всего проекта (архитектура, стиль работы, дедлайны) → этот файл (`CLAUDE.md`)
> В корневом файле дублировать детали не нужно — достаточно упомянуть кратко что фича реализована.

---

## 1. О проекте

**Что строим:** Мобильное и веб-приложение — AI-ассистент для подготовки школьников 8-11 классов к ОГЭ и ЕГЭ. Не просто банк задач, а сократический AI-тьютор, который не выдаёт готовое решение, а помогает ученику самостоятельно прийти к ответу через наводящие вопросы.

**Контекст:** Кейс хакатона от Т-Образование (образовательная платформа Т-Банка) от вымышленной компании EduTech Solutions. Это **проектирование MVP** и подача в формате презентация (мин. 6 слайдов PDF) + видео до 6 минут. Параллельно делаем рабочий MVP-прототип.

**Дедлайн:** 18 мая 2026, 23:59.

**Целевая аудитория:** Школьники 14-18 лет (8-11 классы), готовящиеся к ОГЭ/ЕГЭ. 92% имеют смартфон, среднее экранное время 5-6 часов. Live в TikTok, привыкли к коротко нарезанному адаптивному контенту.

---

## 2. Какие 4 боли закрываем

1. **«С чего начать?»** — отсутствие персональной диагностики пробелов
2. **«Почему я ошибся?»** — банки задач дают только «✓/✗», без объяснения причины ошибки
3. **«Репетитор дорогой»** — 1500-3500 ₽/час, недоступен регионам
4. **«Не вижу прогресса»** — мотивация падает, выгорание у 33% подростков

Главный конкурент — **Т-Число** (T-Bank). Имеет: курсы по темам, multiple choice задания, статичную кнопку «Открыть теорию», после ответа сразу показывает решение. Чего нет: AI-объяснений, адаптивной диагностики, персональной траектории, геймификации. **Наш продукт — это Т-Число с мозгом.**

---

## 3. Функционал MVP

### Функция 1 — Онбординг и диагностика
- Выбор класса (9/11), предметов, целевого балла, даты экзамена
- Адаптивная диагностика ~20 заданий, 15-20 минут (Bayesian Knowledge Tracing)
- Карта знаний: красное / жёлтое / зелёное по темам
- Прогноз балла «если ничего не делать» и «если заниматься по плану»

### Функция 2 — Ежедневная сессия
- 5-15 минут, 3-5 заданий в день
- Подбираются по слабым темам + FSRS (spaced repetition)
- Старт: математика ОГЭ/ЕГЭ, Часть 1 (multiple choice)

### Функция 3 — AI-объяснение ошибки (ЯДРО продукта)
Сократический диалог без выдачи ответа:
1. Пользователь выбирает неверный вариант
2. AI анализирует тип ошибки на основе выбранного варианта
3. Задаёт ОДИН конкретный вопрос про шаг с ошибкой
4. Ведёт по логике пользователя через 1-3 хода диалога
5. Hint level: 1 — наводящий вопрос → 2 — подсказка → 3 — полное объяснение
6. Закрепляющее задание того же типа

**Динамическая теория:** GPT возвращает `theory_ref` — какой раздел теории показать именно на этом шаге диалога. У Т-Числа кнопка «Открыть теорию» статичная (всегда одна для задания), у нас — динамическая (зависит от того где застрял).

Кнопка «объясни сразу» — появляется только после первого вопроса.

### Функция 4 — Прогресс и мотивация
- Streak (ежедневная серия) + Streak Freeze
- Визуальный прогресс по темам
- Прогноз балла обновляется по мере занятий
- Еженедельный мини-вариант ОГЭ/ЕГЭ

### Функция 5 — Push-уведомления
- Напоминание в настраиваемое время
- «Твой streak под угрозой»

### НЕ входит в MVP
- Фото решения (OCR/Photomath-стиль)
- Часть 2 экзамена (развёрнутые ответы)
- Лиги между пользователями
- Другие предметы кроме математики

---

## 4. Архитектура (как всё работает)

### Высокоуровневая схема

```
┌────────────────────────────────────────────────────────┐
│                  КЛИЕНТСКИЙ СЛОЙ                        │
├──────────────────┬──────────────────┬──────────────────┤
│  Web (Next.js)   │  iOS (Swift)     │  Android (Kotlin)│
│  на Vercel       │  нативное app    │  если успеем     │
└────────┬─────────┴─────────┬────────┴────────┬─────────┘
         │                   │                  │
         │       HTTPS (REST + SSE)             │
         └───────────────────┼──────────────────┘
                             ▼
            ┌────────────────────────────────┐
            │  Backend API на Railway         │
            │  Python + FastAPI               │
            │  REST + Server-Sent Events      │
            └─┬──────┬────────────┬─────────┬┘
              │      │            │         │
       ┌──────▼┐  ┌──▼──┐  ┌──────▼─┐ ┌────▼──────┐
       │Postgres│  │Redis│  │ARQ     │ │OpenAI API │
       │+pgvect │  │     │  │workers │ │(GPT-4o)   │
       └────────┘  └─────┘  └────────┘ └───────────┘
```

### Принципы

- **Один API на все платформы.** Web, iOS, Android идут через одни эндпоинты. Бизнес-логика только на бэкенде.
- **Авторизация через Яндекс ID + email/password.** Бэкенд выдаёт JWT, клиент хранит (cookie на вебе, Keychain на iOS).
- **Сократический AI через SSE.** Бэкенд стримит ответ GPT в реальном времени — юзер видит как AI «печатает».
- **Российская аудитория = российские сервисы.** Яндекс ID, не Google. Хостинг Railway/Vercel приемлем для MVP; для продакшена 152-ФЗ потребует Yandex Cloud / VK Cloud.

---

## 5. Ключевые сценарии работы

### Сценарий 1 — Регистрация через Яндекс ID

```
Клиент → Яндекс OAuth → получает code
Клиент → POST /auth/yandex { code, redirect_uri } → наш API
API → exchange code на access_token (Яндекс)
API → GET https://login.yandex.ru/info → { id, email, name }
API → ищет/создаёт юзера в Postgres по yandex_id
API → выдаёт наш JWT (access + refresh)
Клиент → сохраняет JWT → онбординг
```

### Сценарий 2 — Диагностика

```
POST /diagnostic/start → сессия в Redis, первое задание средней сложности
POST /diagnostic/answer → обновление Bayesian модели:
  правильно → задание сложнее или новая тема
  неправильно → проще или пререквизит
После 20 заданий → END
GET /diagnostic/result → карта знаний + прогноз балла
```

### Сценарий 3 — Ежедневная сессия

```
GET /sessions/today → 3-5 заданий (слабые темы + FSRS due)
POST /tasks/{id}/answer
  правильно → обновить BKT, FSRS на следующий интервал, next task
  неправильно → создать dialogue_id → сократический диалог
```

### Сценарий 4 — Сократический диалог (ЯДРО)

```
GET /dialogue/{id}/stream (SSE)
  API собирает контекст: задача, правильный ответ, неверный вариант юзера,
  типичные ошибки из БД, история диалога
  API → OpenAI streaming=true
  API стримит токены клиенту через SSE
  В конце шлёт { theory_ref: { title, section_id } }

Клиент видит ответ AI как печатается + кнопку «Открыть теорию»

POST /dialogue/{id}/reply { text } → новый stream
После 3 ходов или resolved=true → закрепляющая задача
```

### Сценарий 5 — Streak и push

```
Завершение сессии → streak += 1
Пропустил день → Streak Freeze применяется автоматически (если есть)
   Иначе → streak = 0
Каждый вечер в 19:00 → APNs push если не было сессии:
  «Твоя серия 12 дней под угрозой 🔥»
```

---

## 6. Технологический стек

### Бэкенд (Railway)
- **Python 3.12 + FastAPI** — async, OpenAPI из коробки
- **Uvicorn** — ASGI сервер
- **SQLAlchemy 2.0 (async)** + **asyncpg** — ORM + драйвер PostgreSQL
- **Alembic** — миграции
- **Pydantic v2** — валидация
- **redis-py** — async Redis
- **ARQ** — фоновые задачи на asyncio
- **httpx** — HTTP клиент (OpenAI, Яндекс)
- **python-jose** — JWT
- **passlib + bcrypt** — пароли
- **sse-starlette** — Server-Sent Events
- **openai** — OpenAI SDK
- **tiktoken** — подсчёт токенов

### БД и кеш (Railway addons)
- **PostgreSQL 16** — основная БД
- **pgvector** — векторный поиск для RAG (`CREATE EXTENSION vector;`)
- **Redis 7** — кеш, сессии диагностики, очереди, streak

### AI / ML
- **OpenAI GPT-4o** — сократический диалог
- **OpenAI text-embedding-3-small** — векторизация теории
- **FSRS алгоритм** — spaced repetition
- **Bayesian Knowledge Tracing** — своя реализация mastery tracking

### Web (Vercel)
- **Next.js 14** (App Router) + **TypeScript 5+**
- **TailwindCSS** + **shadcn/ui**
- **TanStack Query** — работа с API
- **Zustand** — глобальное состояние
- **react-hook-form + zod** — формы
- **eventsource-parser** — SSE стрим
- **KaTeX** — рендер формул

### iOS (Native Swift)
- **Swift 5.10 + SwiftUI**
- **async/await + URLSession** — HTTP + SSE
- **Keychain Services** — JWT
- **ASWebAuthenticationSession** — OAuth Яндекс
- **UserNotifications** — APNs push
- **Swift Charts** — графики прогресса
- **iosMath / SwiftMath** — рендер формул

### Android (если успеем)
- **Kotlin + Jetpack Compose**
- **Retrofit + OkHttp** + **OkHttp-EventSource** для SSE
- **DataStore** + **EncryptedSharedPreferences**
- **Hilt** — DI
- **AppAuth** — OAuth Яндекс
- **FCM** — push

### Хостинг
- **Railway** — Backend + PostgreSQL + Redis (Hobby план $5/мес кредит)
- **Vercel** — Web (бесплатный план)
- **GitHub** — монорепо
- **TestFlight** — бета iOS

### CI/CD и инструменты
- **GitHub Actions** — пайплайны
- **Docker + docker-compose** — локальная разработка
- **Ruff + mypy** — линтер Python
- **ESLint + Prettier** — TypeScript
- **SwiftLint** — Swift
- **Sentry** — мониторинг ошибок
- **OpenAPI / Swagger UI** — авто-дока API

---

## 7. Структура репозитория (монорепо)

```
edutech/
├── backend/                    # Python FastAPI → Railway
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── api/v1/
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── diagnostic.py
│   │   │   ├── sessions.py
│   │   │   ├── tasks.py
│   │   │   ├── dialogue.py     # SSE стриминг
│   │   │   ├── progress.py
│   │   │   ├── theory.py
│   │   │   └── streak.py
│   │   ├── core/               # JWT, db, redis
│   │   ├── models/             # SQLAlchemy
│   │   ├── schemas/            # Pydantic
│   │   ├── services/           # бизнес-логика
│   │   │   ├── ai_service.py
│   │   │   ├── yandex_auth_service.py
│   │   │   ├── diagnostic_service.py
│   │   │   ├── fsrs_service.py
│   │   │   └── progress_service.py
│   │   └── workers/            # ARQ
│   ├── migrations/             # Alembic
│   ├── tests/
│   ├── requirements.txt
│   └── railway.toml
├── web/                        # Next.js → Vercel
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (app)/onboarding/
│   │   ├── (app)/diagnostic/
│   │   ├── (app)/today/
│   │   ├── (app)/task/[id]/
│   │   ├── (app)/progress/
│   │   └── (app)/theory/[id]/
│   ├── components/
│   ├── lib/
│   │   ├── api.ts
│   │   └── auth.ts
│   ├── public/tasks/           # картинки задач (MVP)
│   └── package.json
├── EduTech/                    # Swift нативное (Xcode)
│   └── EduTech/
│       ├── App/           EduTechApp, AppState, Router, RootView, Config
│       ├── Core/
│       │   ├── Network/   APIClient (actor), SSEClient, Endpoint, APIError
│       │   ├── Auth/      KeychainStore, TokenManager (actor)
│       │   ├── Storage/   AppDefaults
│       │   ├── Notifications/  LocalNotificationManager
│       │   └── Theme/     appBg, appFg, appAccent=#FFD000
│       ├── Models/        Models.swift — все Codable (snake_case→camelCase)
│       ├── Features/      Onboarding, Session, Task, Booster, Progress, Profile
│       ├── Shared/        PrimaryButton, GlassCard, TaskImage, MathText
│       └── Resources/Mascot/  idle.mp4, thinking.mp4, investigating.mp4
├── android/                    # Kotlin (опционально)
├── docs/
└── .github/workflows/
    ├── backend.yml             # → Railway
    ├── web.yml                 # → Vercel
    └── ios.yml                 # → TestFlight
```

---

## 12. Безопасность

- HTTPS везде (Railway и Vercel дают из коробки)
- JWT access token TTL 15 минут + refresh token 30 дней в Redis
- Пароли — bcrypt
- Rate limiting через Redis (10 AI-вызовов в минуту на юзера)
- CORS — белый список доменов
- OpenAI ключ ТОЛЬКО на бэкенде, никогда не на клиенте
- YANDEX_CLIENT_SECRET ТОЛЬКО на бэкенде, никогда не в `NEXT_PUBLIC_*`
- Валидация через Pydantic
- Яндекс OAuth state параметр для защиты от CSRF
- В Яндекс OAuth должны быть включены scopes `login:info` и `login:email`

---

## 14. Стоимость на хакатон

| Сервис | Цена |
|---|---|
| Railway Hobby | $5/мес кредит (бесплатно) |
| Vercel | бесплатно |
| OpenAI GPT-4o | ~$10-15 на всё тестирование |
| GitHub | бесплатно |
| Sentry free tier | бесплатно |
| **Итого** | **~$10-15** |

---

## 15. Дизайн

Стиль вдохновлён Т-Банком: жёлтый (#FFD000) + чёрный + белый, минималистичный UI, жирная типографика. Не копируем 1-в-1.

**Ключевой слайд презентации:** «До / После» — слева Т-Число (сразу показывает решение), справа наш сократический диалог.

---

## 16. Порядок работы

1. Бэкенд скелет — FastAPI на Railway, PostgreSQL, базовая auth
2. Схема БД — все таблицы + миграции Alembic
3. Загрузка данных — 20-30 задач по математике с typical_errors и теорией
4. API задач + ответов — `/tasks/*`, `/sessions/today`
5. AI-сервис — `/dialogue/*` с SSE стримингом OpenAI
6. Веб приложение — Next.js на Vercel, ключевые экраны
7. iOS приложение — Swift, ключевые экраны
8. Прогресс и streak — `/progress/*`, `/streak/*`
9. Диагностика — упрощённая Bayesian модель
10. Android — если время осталось

---

## 25. Стиль работы

- Общение с пользователем (Родион) на русском, неформально, коротко
- Не писать комментариев в коде «что делает функция» — имена должны говорить сами
- Не делать преждевременных абстракций
- При выборе технологий учитывать российскую аудиторию (Яндекс ID > Google, не использовать Firebase)
- Бэкенд первичен — это API-first проект, клиенты добавляются по очереди (Web → iOS → Android)
- При git staging — только конкретные файлы по имени (не `git add -A`), иначе Android-скелеты попадают в коммит
