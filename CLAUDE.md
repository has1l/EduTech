# EduTech Solutions — AI-ассистент для подготовки к ОГЭ/ЕГЭ

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
├── ios/EduTech/                # Swift нативное
│   ├── App/
│   ├── Features/
│   │   ├── Auth/
│   │   ├── Onboarding/
│   │   ├── Diagnostic/
│   │   ├── Today/
│   │   ├── Task/
│   │   │   ├── TaskView.swift
│   │   │   └── DialogueView.swift  # SSE
│   │   ├── Progress/
│   │   └── Theory/
│   └── Core/
│       ├── Network/
│       │   ├── APIClient.swift
│       │   └── SSEClient.swift
│       └── Auth/KeychainStorage.swift
├── android/                    # Kotlin (опционально)
├── docs/
└── .github/workflows/
    ├── backend.yml             # → Railway
    ├── web.yml                 # → Vercel
    └── ios.yml                 # → TestFlight
```

---

## 8. Структура БД

```sql
users (
  id UUID PK,
  email TEXT UNIQUE,
  password_hash TEXT NULLABLE,
  yandex_id TEXT UNIQUE NULLABLE,
  grade INT,
  target_score INT,
  exam_date DATE,
  created_at TIMESTAMP
)

subjects (id, code, title)

topics (
  id UUID PK,
  subject_id FK,
  code TEXT,                    -- "1.3", "7.5" и т.д.
  title TEXT,
  weight_in_exam FLOAT,
  difficulty INT,
  exam_task_number INT,         -- номер задания ЕГЭ (1–12), NULL для OGE
  bank_ege_topic_id INT         -- ID подтемы на bank-ege.ru, NULL для ручных тем
)

topic_prerequisites (topic_id FK, prerequisite_id FK)

tasks (
  id UUID PK,
  topic_id FK,
  type TEXT,                    -- multiple_choice | short_answer
  question_text TEXT,
  question_image_url TEXT,
  options JSONB,                -- [{id:"A", text:"67.5"}]
  correct_answer TEXT,
  solution_steps JSONB,
  typical_errors JSONB,         -- маппинг неверный_вариант → тип ошибки + вопрос
  theory_section_ids TEXT[],
  difficulty INT
)

theory_sections (
  id UUID PK,
  topic_id FK,
  title TEXT,
  content TEXT,                 -- markdown
  embedding vector(1536)        -- pgvector
)

attempts (
  id UUID PK,
  user_id FK,
  task_id FK,
  user_answer TEXT,
  is_correct BOOLEAN,
  time_spent_sec INT,
  created_at TIMESTAMP
)

ai_dialogues (
  id UUID PK,
  attempt_id FK,
  messages JSONB,               -- [{role, content, theory_ref}]
  hint_level INT,               -- 1-3
  resolved BOOLEAN,
  created_at TIMESTAMP
)

user_topic_progress (
  user_id FK,
  topic_id FK,
  mastery_level FLOAT,          -- 0.0-1.0 (BKT)
  attempts_count INT,
  correct_count INT,
  status TEXT,                  -- red | yellow | green
  PRIMARY KEY (user_id, topic_id)
)

fsrs_cards (
  id UUID PK,
  user_id FK,
  task_id FK,
  state INT,                    -- new | learning | review | relearning
  due TIMESTAMP,
  stability FLOAT,
  difficulty FLOAT,
  last_review TIMESTAMP
)

streaks (
  user_id FK PK,
  current_streak INT,
  longest_streak INT,
  last_session_date DATE,
  freezes_available INT
)
```

---

## 9. API endpoints

```
POST   /auth/register              — email/password
POST   /auth/login                 — email/password
POST   /auth/yandex                — ⭐ Яндекс ID OAuth code exchange
POST   /auth/refresh
POST   /auth/logout

GET    /users/me
PATCH  /users/me

POST   /diagnostic/start
POST   /diagnostic/answer
GET    /diagnostic/result

GET    /sessions/today
POST   /sessions/{id}/complete
GET    /sessions/path              — путь ЕГЭ: все секции (задания 1–12) с нодами

GET    /tasks/{id}
POST   /tasks/{id}/answer
GET    /tasks/subtopic-session?topic_id=...&count=5  — 5 случайных задач подтемы
GET    /tasks/image-proxy?url=...  — проксирует картинки bank-ege.ru (Referer bypass)

POST   /dialogue/{id}/reply
GET    /dialogue/{id}/stream        — SSE
POST   /dialogue/{id}/give-up

GET    /progress/map
GET    /progress/score-prediction
GET    /progress/timeline

GET    /theory/{section_id}

GET    /streak
POST   /streak/freeze
```

**Авторизация:** все эндпоинты кроме `/auth/*` требуют JWT в `Authorization: Bearer <token>`.

**Формат ответов:**
```json
{ "data": {...} }
{ "error": { "code": "...", "message": "..." } }
```

---

## 10. Промпт GPT для сократического диалога

```
System:
Ты педагог по математике. Ученик решал задачу и ошибся.
Твоя задача — помочь ему найти ошибку САМОСТОЯТЕЛЬНО.

Правила:
- НЕ давай правильный ответ
- Задай ОДИН конкретный вопрос про шаг где скорее всего ошибка
- Если после 2 вопросов не понял — дай подсказку (не ответ)
- После 3 шагов — можно объяснить полностью
- Тон: дружелюбный, не осуждающий

Контекст:
Задача: {условие}
Правильный ответ: {ответ}
Ответ ученика: {ответ_ученика}
Тип вероятной ошибки: {из typical_errors}
История диалога: {messages}

Верни JSON:
{
  "question": "...",
  "hint_level": 1,
  "error_hypothesis": "...",
  "theory_ref": {
    "title": "Название раздела",
    "section_id": "..."
  }
}
```

---

## 11. Переменные окружения

### Railway (backend)
```
DATABASE_URL          — авто из Postgres addon
REDIS_URL             — авто из Redis addon
JWT_SECRET            — рандомная строка 64+ символов
JWT_ALGORITHM         — HS256
ACCESS_TOKEN_TTL      — 900 (15 минут)
REFRESH_TOKEN_TTL     — 2592000 (30 дней)
OPENAI_API_KEY
YANDEX_CLIENT_ID
YANDEX_CLIENT_SECRET  — хранить только на backend/Railway
YANDEX_REDIRECT_URI_WEB = https://edu-tech-self.vercel.app/auth/yandex/callback
YANDEX_REDIRECT_URI_MOBILE
SENTRY_DSN
ENVIRONMENT           — development | production
```

### Vercel (web)
```
NEXT_PUBLIC_API_URL           — https://edutech-production-3cad.up.railway.app
NEXT_PUBLIC_YANDEX_CLIENT_ID
NEXT_PUBLIC_YANDEX_REDIRECT_URI = https://edu-tech-self.vercel.app/auth/yandex/callback
```

### iOS (Info.plist / Config.swift)
```
API_BASE_URL
YANDEX_CLIENT_ID
URL_SCHEME = edutech
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

## 13. Что уже добавлено

### Яндекс ID OAuth

Реализован рабочий web-flow входа через Яндекс ID:

- На `/login` и `/register` добавлена кнопка `Войти через Яндекс ID`
- Frontend генерирует `state`, сохраняет его в `localStorage` и редиректит на `https://oauth.yandex.ru/authorize`
- Callback страница: `/auth/yandex/callback`
- Callback проверяет `state`, отправляет `code` на backend и сохраняет нашу JWT-сессию
- Backend endpoint: `POST /api/v1/auth/yandex`
- Backend меняет `code` на OAuth token через Яндекс, получает профиль через `login.yandex.ru/info`
- Пользователь ищется по `yandex_id`; если его нет, backend линкует существующего пользователя по email или создаёт нового
- После входа пользователь попадает в `/onboarding` или `/today`

### Иерархическая структура ЕГЭ: задания 1–12 с подтемами

- `ALL_EGE_SUBTOPICS` в `bank_ege_client.py` — 77 подтем по заданиям 1–12 (sourced from `new-api.bank-ege.ru/api/ege/exam_topics?subject_id=19`)
- `TASK_SECTIONS` — название и визуальная сложность каждого задания: 1=зелёный (задания 1,2,4), 2=жёлтый (задания 3,5–11), 3=красный (задание 12)
- `ensure_ege_subtopics_seeded()` запускается при старте сервера и добавляет все недостающие подтемы
- `Topic.exam_task_number` и `Topic.bank_ege_topic_id` — поля добавлены в миграции `0005`
- EGE `source_id` имеет префикс `ege_` (например `ege_12345`) чтобы не пересекаться с OGE ID
- Дублирующиеся подтемы из API (3.9 Конус id=1303, 6.3 Иррациональные уравнения id=1265) пропущены — используются более богатые версии (id=2392 и id=2401)

**Путь (session/path):**
- `GET /sessions/path` возвращает `SessionPathOut { sections: TaskSection[] }` вместо плоского `nodes`
- Каждая секция: `{ task_number, title, difficulty, nodes: PathNode[] }`
- Блокировка нод — **независимая внутри каждого задания**: первая невыполненная = `current`, остальные = `locked`; разные задания можно проходить параллельно
- Сортировка нод: кортеж `(int(major), int(minor))` — корректно ставит 1.10 после 1.9
- Нода считается выполненной при `correct_count >= 1`

**Мини-сессия подтемы:**
- Тап на ноду → `GET /tasks/subtopic-session?topic_id=...&count=5` → 5 случайных задач
- Первая задача открывается на `/task/{id}?queue=id2,id3,id4,id5`
- Прогресс-бар на странице задачи: позиция = `totalInSession - queue.length`

**Фронт (session/page.tsx):**
- Каждое задание — секция с цветным заголовком (номер, название, счётчик X/Y)
- Цвет заголовка определяется `difficulty` секции (success/accent/danger)
- Зигзаг-путь с нодами внутри каждой секции, сбрасывается для новой секции

---

### Задачи из bank-ege.ru с картинками

Реализован импорт задач из `bank-ege.ru` через их публичный API:

- `bank_ege_client.py` — лениво подгружает задачи когда в БД не хватает для дневной сессии
- Картинки в задачах — это `data:image/png;base64,...` URI, встроенные в HTML `<img src>`, а не внешние URL
- `_extract_image` принимает как `http://...`, так и `data:image/...` URI
- `question_image_url` — тип `Text` (base64 не влезает в varchar). Миграция: `0004_task_image_text.py`
- `_strip_html` сохраняет структуру текста: `<br>` → `\n`, `<li>` → `• `, `<p>/<div>` → `\n`
- Задания с текстом «...» или «…» (усечённые) принимаются только если есть картинка — текст служит подписью
- Ротация вариантов: Redis ключ `bank_ege:used_variants` — НЕ чистить при сбросе тестовых данных (иначе тот же вариант выпадет снова)
- Правильный сброс тест-данных: `TRUNCATE` нужных таблиц + `DEL today_session:*` (не FLUSHDB)

### AI-диалог: картинки + «Объяснить сразу»

- `stream_socratic` передаёт картинку задачи GPT-4o через vision API (content type `image_url`)
- Картинка шлётся только на **первый ход** диалога (`dialogue.messages` пустой) — base64 URI это 30-80k токенов, на каждый ход слишком дорого
- `hint_level=3` — GPT объясняет полностью и называет правильный ответ (правило «НЕ называй ответ» снимается)
- `POST /dialogue/{id}/give-up` — устанавливает `hint_level=3`, возвращает `{correct_answer}`, затем запускается stream с полным объяснением
- После «Объяснить сразу» поле ввода реплик остаётся открытым для уточняющих вопросов
- Кнопка «Следующее задание» появляется сразу после завершения stream в фазе `giveup`

### SSE + SQLAlchemy: важный паттерн

FastAPI закрывает `db` сессию (из `Depends(get_db)`) сразу когда endpoint-функция возвращает `EventSourceResponse(generator())` — до того как генератор начал стримить. Поэтому `await db.commit()` внутри генератора молча фейлится.

**Правило:** любые записи в БД внутри SSE-генератора делать через `async with SessionLocal() as session:` (свежая сессия), не через `db` из зависимости. Плюс `flag_modified(obj, "field")` для JSONB-полей чтобы SQLAlchemy точно видел изменение.

### Отображение задач на фронте

- Картинки: если URL начинается с `data:` — вставляется напрямую; иначе через `/tasks/image-proxy?url=...`
- `/tasks/image-proxy` — эндпоинт на бэкенде с заголовком `Referer: https://bank-ege.ru/` для обхода hotlink-защиты
- Текст задачи скрывается когда есть картинка и текст обрывается на «...» / «…»
- `whitespace-pre-wrap` на тексте задачи — сохраняет переносы строк из `_strip_html`
- Картинки ограничены по высоте: `max-h-64` на странице задачи, `max-h-52` в бустере

---

### Страница задачи — полный редизайн (Яндекс-стиль)

**URL-параметры сессии** (все передаются при навигации между задачами):
- `queue=id1,id2,...` — оставшиеся задачи в очереди
- `total=N` — общее количество задач в сессии (фиксировано в начале)
- `all=id1,id2,...` — все ID задач сессии (для навигации по точкам)
- `solved=1,3,...` — позиции (1-based) верно решённых самостоятельно
- `failed=2,...` — позиции неверно отвеченных
- `ai=4,...` — позиции решённых с помощью AI
- `booster=1` — открыто из бустера (при верном ответе удаляет из бустера)
- `review=1` — открыто из повторения (после завершения → `/session?unlocked=1`)

**Цвета точек навигации:**
- Чёрный — текущая задача
- Зелёный — решена самостоятельно (`solvedPositions`)
- Жёлтый — решена с AI (`aiPositions && !solved`)
- Красный — ошиблись и не решили (`failedPositions && !solved && !ai`)
- Серый — не решалась

**Фаза-автомат (Phase):**
`"question" → "submitting" → "correct" | "wrong" → "dialogue" → "giveup"`
- `wrong`: показывает баннер с неверным ответом, пользователь может переделать сам или нажать «Помоги разобрать»
- Баннер исчезает как только пользователь начинает редактировать ответ (`answer !== wrongAnswer`)
- `dialogue`: AI-диалог с SSE стримингом
- `giveup`: полное объяснение + правильный ответ

**sessionStorage** — диалог сохраняется по ключу `dlg_${taskId}` и восстанавливается при возврате к задаче. Очищается при `phase === "correct"` или `"question"`.

**Кнопка "+"** — добавляет 5 новых задач того же подтипа в конец очереди (фильтрует уже виденные IDs). Обновляет URL через `router.replace`.

**Прогресс-бар "X/5 для разблокировки следующего подтипа"** — под точками навигации. При ≥5 зеленеет. Рядом кнопка **«Завершить»** (серая до порога, зелёная после).

**Кнопка «Завершить»** — при нажатии: все незелёные задачи из `allIds` добавляются в бустер (reason: "ai" если `aiPositions`, иначе "skipped"), затем переход на `/session` (или `/booster` если `booster=1`).

**Порог прохождения подтипа** изменён с 1 до **5** верно решённых (`correct_count >= 5` в `task_service.py`).

**addToKB** вызывается при верном ответе → задача попадает в базу знаний.

---

### Бустер (`/booster`)

**`web/src/lib/booster.ts`** — localStorage-хранилище:
```typescript
interface BoosterItem {
  taskId: string;
  topicId: string;
  reason: "skipped" | "ai";
  questionPreview: string;
  addedAt: number;
}
// Ключ: "booster_v1"
```

**Когда задания попадают в бустер:** только при нажатии «Завершить» в конце сессии:
- `phase === "wrong"` (или не решена) → reason: "skipped"
- `phase === "giveup"` / `"dialogue"` → reason: "ai"

**Когда удаляются из бустера:**
- Верный самостоятельный ответ (в обычной сессии или в бустере) → `removeFromBooster(taskId)`
- Верный ответ также вызывает `addToKB`

**Если в бустере решил с AI** → остаётся в бустере, тег обновляется на "ai" (`updateBoosterReason`), переходит к следующему.

**Страница `/booster`** — split-layout:
- **Слева** — полноценный `InlineTaskSolver` с вводом ответа + AI-диалогом + SSE
- **Справа** — список задач сгруппированных по заданию (1–12) и подтипу, без превью текста
- Данные топиков берутся из `useSessionPath()` по `topicId` → `{ taskNumber, difficulty, subtopicNumber, subtopicTitle }`
- На мобиле (< 768px) тап по элементу навигирует прямо на страницу задания

**AppNav**: вкладка «Бустер» с жёлтым бейджем-счётчиком (`getBoosterCount()`), обновляется при смене `pathname`.

---

### База знаний (`/progress`)

**`web/src/lib/knowledge-base.ts`** — localStorage-хранилище освоенных задач:
```typescript
interface KBItem { taskId: string; topicId: string; solvedAt: number; }
// Ключ: "kb_v1"
```

**Уровневая система:**
| Уровень | Название | Emoji | Порог |
|---|---|---|---|
| 1 | Новичок | 🌱 | 0 |
| 2 | Ученик | 📖 | 10 |
| 3 | Знаток | 🎯 | 25 |
| 4 | Мастер | ⚡ | 50 |
| 5 | Эксперт | 🏆 | 100 |

**Кнопка «Повторение — мать учения»:**
1. Вызывает `POST /sessions/reset-path` — сбрасывает `correct_count = 0` для всех завершённых подтипов
2. Очищает КБ (`clearKB()`)
3. Берёт до 20 случайных задач из КБ (shuffle) и запускает сессию с `review=1`
4. После завершения → `/session?unlocked=1`

**`POST /sessions/reset-path`** — новый бэкенд-эндпоинт: обновляет `user_topic_progress` (`correct_count=0, attempts_count=0, status='red'`) для всех записей пользователя где `correct_count >= 5`.

**`?unlocked=1` на `/session`** — все заблокированные ноды (`state === "locked"`) показываются как `"current"` и кликабельны, позволяя повторять любой подтип.

**Задания циклятся**: в `get_random_tasks_for_topic` уже есть fallback — если все задачи подтипа решены, возвращаются все задачи (включая решённые ранее). Это обеспечивает бесконечное повторение.

---

### Страница прогресса — редизайн

`/progress` использует реальные данные:
- `useStreak()` → текущая серия, рекорд, заморозки
- `useSessionPath()` → карта знаний по реальным подтипам (correct_count/5 = mastery)
- `getKBCount()` / `getKBLevel()` → база знаний из localStorage

**Карта знаний** сгруппирована по номерам заданий (1–12), для каждой секции:
- Цветной бейдж задания + прогресс-бар секции (mastered/total)
- Детализация: каждый подтип со своей мини-полоской `correct_count/5`
- Зелёный ≥5, жёлтый >0 <5, серый = 0

**Прогноз балла** — пока mock-данные (алгоритм предсказания не реализован).

**Кнопка «Повторение — мать учения» заблокирована** до тех пор, пока не выполнены ВСЕ подтипы (`correct_count >= 5` у каждой ноды). После нажатия никуда не перекидывает — просто сбрасывает и показывает сообщение об успехе на той же странице. `allCompleted = allNodes.length > 0 && allNodes.every((n) => n.correct_count >= 5)`.

---

### Серия (Streak) — система огонька

**Бэкенд:** `POST /streak/record` — новый идемпотентный эндпоинт в `streak.py`:
- Вызывается без `session_id` — достаточно JWT
- Увеличивает серию максимум раз в день
- Если пропустил 1 день и есть заморозка — тратит заморозку, серия не сгорает
- Если пропустил 2+ дня — серия сбрасывается в 1

**Фронт (`task/[id]/page.tsx`):**
- Константа `THRESHOLD = 5` — количество задач в подтипе для разблокировки
- `POST /streak/record` вызывается ТОЛЬКО когда `newSolvedSize === THRESHOLD` (не на каждый правильный ответ)
- `newSolvedSize` = `solvedPositions.size + (1 если текущая позиция ещё не в solved)`
- Flash-баннер `streakFlash` появляется на 3 секунды: `"🔥 N дней подряд!"` с `animate-bounce-in`
- Баннер: `fixed inset-x-0 top-16 z-50`, `pointer-events-none`
- После записи серии инвалидируется кеш: `queryClient.invalidateQueries({ queryKey: ["streak"] })`

---

### Маскот (анимированный персонаж AI-репетитора)

Белый blob-персонаж в стиле мема «Омочи/Пиджак», заанимирован через Nano Bano. Файлы в `web/public/mascot/`:
- `idle.mp4` — нейтральная улыбка (в шапке AI-репетитора, всегда)
- `thinking.mp4` — профессор в очках (когда AI написал сообщение и ждёт)
- `investigating.mp4` — с лупой (когда AI думает перед ответом, и в фазе `wrong`)

**Использование в `task/[id]/page.tsx`:**
- Шапка «AI-репетитор»: всегда `idle.mp4`
- Фаза `wrong` (рядом с «Помоги разобрать»): `investigating.mp4` 12×12
- Завершённые сообщения ассистента: `thinking.mp4` 9×9
- Стриминг: `key={streamingText ? "writing" : "investigating"}` — меняет `src` между `investigating` (AI ещё не начал) и `thinking` (текст уже идёт), `key` заставляет `<video>` перемонтироваться и начать с начала

**CSS-трюк:** `mix-blend-mode: multiply` на `<video>` убирает белый/шахматный фон без ffmpeg.

---

### Инструмент рисования на странице задачи

**Архитектура:** stroke-based (не растровый). Каждое нажатие без отжатия = один объект `Stroke`:
```typescript
type Stroke = { id: string; points: [number, number][]; color: string; width: number };
```
Штрихи хранятся в localStorage по ключу `drawing_${taskId}` как JSON-массив. Восстанавливаются при навигации между задачами.

**Canvas:** `fixed inset-0 z-40` — покрывает весь экран. Размеры = `window.innerWidth × window.innerHeight`. При `activeTool = null` → `pointer-events: none` (прозрачен для кликов). При активном инструменте → `pointer-events: auto`.

**Инструменты:**
- **Маркер** (`Pencil`): красный `#ef4444`, толщина 3px. Рисует инкрементально (по сегментам) для производительности; при `pointerUp` добавляет штрих в state.
- **Ластик** (`Eraser`): при движении проверяет каждый штрих через `strokeHit()` (distance point-to-segment) с порогом 14px. Если попал — удаляет **весь штрих целиком** (не попиксельно).

**Тулбар:** `relative z-50` — всегда кликабелен поверх канваса. Кнопка «X» появляется только когда есть хоть один штрих. Подсказка при активном инструменте.

**Ключевые рефы:**
- `strokesRef` — синхронизирован со state, используется в обработчиках (без stale closure)
- `currentStrokeRef` — текущий незавершённый штрих (не в state, чтобы не вызывать re-render при каждом pointermove)
- `drawingRef.current.isDrawing` — флаг рисования

**`useEffect` для инициализации:** зависимости `[id, task?.id]` — важно включить `task?.id`, иначе эффект не перезапустится когда задание загрузится (при `isLoading=true` канвас ещё не в DOM).

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

## 17. AI-персональный план подготовки

**Доступ:** только после прохождения диагностики (`diagnostic_completed_at` на пользователе). Вкладка «Мой план» на странице `/session` — рядом с «Путь».

**Бэкенд:**
- `GET /plan` — возвращает сохранённый план (`study_plan JSONB` в `users`) или `needs_generation: true`
- `POST /plan/generate` — GPT-4o анализирует `user_topic_progress` по всем 12 заданиям + целевой балл + дней до экзамена → JSON с приоритетным порядком тем и объяснением «почему» для каждой → сохраняется в `users.study_plan`
- GPT получает инструкцию: роль опытного репетитора-методиста, вернуть JSON с `summary` + `groups[]` (task_number, priority, why, status)

**Фронт (`session/page.tsx`):**
- Табы `Путь ⚡ | Мой план 🧠` — pill switcher
- Нет диагностики → экран с CTA «Пройти диагностику»
- Нет плана → экран «Составить план» с кнопкой → `POST /plan/generate`
- Есть план → карточки по приоритету: цвет по статусу (red=weak, yellow=medium, green=strong), AI-текст «почему», прогресс-бар mastery, кнопка «Начать» → бросает в первую невыполненную подтему задания
- Кнопка «Обновить» для пересоздания

**Флаг диагностики:** `diagnostic_completed_at` (migration 0008) ставится в `POST /diagnostic/submit`.

---

### Бустер и база знаний — перенос в БД (migration 0009)

Ранее бустер и KB хранились в localStorage. Теперь — в PostgreSQL.

**Таблицы:**
- `booster_items` (user_id, task_id, topic_id, reason, question_preview, added_at) — unique(user_id, task_id), upsert при добавлении
- `knowledge_base_items` (user_id, task_id, topic_id, solved_at) — unique(user_id, task_id)

**API:**
- `GET /booster` — список; `GET /booster/count` — для бейджа в nav
- `POST /booster` — upsert (on_conflict_do_update); `DELETE /booster/{task_id}`; `PATCH /booster/{task_id}/reason`
- `GET /kb/stats` — count + level_name + level_emoji + next_at + level_pct
- `POST /kb` — upsert; `POST /kb/clear` — полная очистка (для сброса прогресса)

**Фронт — хуки в queries.ts:**
`useBooster`, `useBoosterCount`, `useAddToBooster`, `useRemoveFromBooster`, `useUpdateBoosterReason`, `useKBStats`, `useAddToKB`, `useClearKB`

**Что изменилось в компонентах:**
- `app-nav.tsx` — бейдж бустера из `useBoosterCount()` вместо localStorage
- `task/[id]/page.tsx` — `addToBoosterMutation.mutate(...)`, `removeFromBoosterMutation.mutate(id)`, `addToKBMutation.mutate(...)`
- `booster/page.tsx` — `useBooster()` вместо `getBooster()`, все операции через мутации; `BoosterItem` теперь snake_case из API (`task_id`, `topic_id`)
- `progress/page.tsx` — `useKBStats()` вместо getKBCount/getKBLevel; `useClearKB()` вместо clearKB()

**Logout** (`profile/page.tsx`) — очищает только `drawing_*` из localStorage и sessionStorage; бустер и KB остаются в БД.

**Важно:** `BoosterItem` тип теперь в `lib/types.ts` (snake_case из API), старый `lib/booster.ts` не используется для чтения/записи данных.

---

## 18. Прогноз балла — GPT-анализ

**Эндпоинт:** `GET /progress/score-prediction`

**Логика:**
- Агрегирует mastery по каждому из 12 заданий из `user_topic_progress`: mastery = avg(correct_count / 5) по всем подтемам задания, cap 1.0
- Передаёт GPT-4o: % освоения по каждому заданию, целевой балл, дни до экзамена
- GPT возвращает `by_plan`, `if_nothing`, `explanation`
- Результат кешируется в Redis на **24 часа** (ключ `score_pred:{user_id}`)

**Шкала ЕГЭ (Часть 1, задания 1–12):**
- Максимум 12 первичных баллов = **70 тестовых** (не 100!)
- Таблица: 1→6, 2→11, 3→17, 4→22, 5→27, 6→34, 7→39, 8→46, 9→52, 10→58, 11→64, 12→70
- Отображаем только Часть 1 — Часть 2 (задания 13–19) не охвачена MVP

**ОГЭ:** GPT возвращает оценку 3/4/5 (8–14 первичных = 3, 15–21 = 4, 22+ = 5)

**Формульный fallback:** функции `_formula_predict_ege` / `_formula_predict_oge` в `progress.py`, отключены флагом `USE_GPT_PREDICTION = True`

**Ответ (`ScorePrediction`):**
```python
target: int        # цель пользователя (≤70 для ЕГЭ)
by_plan: int       # прогноз по плану занятий
if_nothing: int    # прогноз без занятий
explanation: str   # 2-3 предложения от GPT
max_possible: int  # 70 для ЕГЭ, 5 для ОГЭ
is_oge: bool
```

**Фронт (`progress/page.tsx` → `ScoreCard`):**
- `useScorePrediction()` хук, staleTime 23 часа
- Пока грузится — skeleton анимация
- Цель для ЕГЭ всегда ≤ 70: `Math.min(rawTarget, 70)`
- Бары: цель / по плану / без занятий — `max = max_possible`
- Дисклеймер «Часть 2 не учитывается» для ЕГЭ

**Профиль (`profile/page.tsx`):**
- Варианты цели ЕГЭ изменены: `40 / 55 / 65 / 70` (вместо 60/75/85/95)
- Под выбором — пояснение про Часть 1 и максимум 70 баллов
- Дефолт при переключении на ЕГЭ: 65

---

## 19. iOS нативное приложение

Проект в `EduTech/EduTech/` (Xcode). `PBXFileSystemSynchronizedRootGroup` — файлы из папки подхватываются автоматически, отдельно в pbxproj не добавлять.

**Ключевые решения:**
- **iOS 26.2+** — ради Liquid Glass (`.glassEffect()`, `GlassEffectContainer`)
- **Bundle ID:** `squad52.dev.EduTech`, team `2NXN9F6VAY` (Free Apple ID, 7-дневные провижны)
- **Анонимная тихая регистрация** — экрана логина нет. Email: `device_<uuid>@anon.edutech.app`, пароль — UUID в Keychain
- **Яндекс ID** — отложен до iOS-клиента в кабинете Яндекса
- **Рисование на задачах** — не делаем

**Структура:**
```
EduTech/EduTech/
├── App/           EduTechApp, AppState, Router, RootView, Config
├── Core/
│   ├── Network/   APIClient (actor), SSEClient, Endpoint, APIError
│   ├── Auth/      KeychainStore, TokenManager (actor)
│   ├── Storage/   AppDefaults
│   ├── Notifications/  LocalNotificationManager (локальные, не APNs)
│   └── Theme/     appBg, appFg, appAccent=#FFD000
├── Models/        Models.swift — все Codable (snake_case→camelCase автоматически)
├── Features/      Onboarding, Session, Task, Booster, Progress, Profile
├── Shared/        PrimaryButton, GlassCard, TaskImage, MathText
└── Resources/Mascot/  idle.mp4, thinking.mp4, investigating.mp4
```

**Важные баги и решения:**

- **`Task` конфликтует со `Swift.Task`** — модель задачи названа `EduTask`
- **DNS симулятора** может не резолвить Railway hostname — на реальном устройстве работает. Лечить: `dscacheutil -flushcache` + `sudo killall -HUP mDNSResponder`
- **Swift 6 / `SWIFT_DEFAULT_ACTOR_ISOLATION = MainActor`** — всё MainActor по умолчанию. Network actors — явные `actor`

---

### SSEClient — формат событий бэкенда

Бэкенд (`ai_service.py`) шлёт строго:
- `event: token` + `data: "слово"` (json.dumps токена) — стриминг текста
- `event: meta` + `data: {"theory_ref": {...}|null, "hint_level": 1}` — финальные метаданные
- `event: done` — завершение
- `event: error` + `data: {"message": "..."}` — ошибка

**Критично:** не `delta`/`theory` как в некоторых других SSE API — именно `token`/`meta`. SSEClient в iOS обрабатывает именно эти имена.

`jsonDecodeString` в SSEClient декодирует JSON-строку токена (`"слово"` → `слово`).

---

### Маскот в iOS

`AVQueuePlayer` + `AVPlayerLooper`, `isMuted = true`, `preventsDisplaySleepDuringVideoPlayback = false`.

**Важно:**
- `playerLayer.backgroundColor = UIColor.clear.cgColor` — иначе фон плеера чёрный
- `videoGravity = .resizeAspectFill` — заполняет круг без чёрных полей
- `.background(Color.white).clipShape(Circle())` на `MascotView` — вместо `.blendMode(.multiply)` (не работало на тёмной теме)

---

### Картинки задач (TaskImage)

- Base64 PNG из bank-ege.ru декодируется с `.ignoreUnknownCharacters`
- Проксированные картинки грузятся через `APIClient.shared.rawRequest` (с auth-заголовком), не через `URLSession.shared`
- `.background(Color.white)` перед `.clipShape` — чтобы чёрные буквы на PNG с прозрачным фоном были видны на тёмной теме
- `Endpoint.imageProxy` возвращает `Endpoint`, не `URL`

---

### LaTeX в диалоге (MathText)

`Shared/MathText.swift` — WKWebView + KaTeX CDN:
- Если текст содержит `\(` или `\[` → рендерит через KaTeX
- Иначе → обычный `Text` (без WKWebView overhead)
- Высота WebView измеряется дважды: сразу и через 1.8 сек (после загрузки KaTeX CDN)
- `@media (prefers-color-scheme: dark)` в HTML — цвет текста адаптируется

**В `DialogueView`:** завершённые сообщения ассистента → `MathText`. Стриминг → обычный `Text` (WKWebView не перезагружается на каждый токен).

---

## 20. Стиль работы

- Общение с пользователем (Родион) на русском, неформально, коротко
- Не писать комментариев в коде «что делает функция» — имена должны говорить сами
- Не делать преждевременных абстракций
- При выборе технологий учитывать российскую аудиторию (Яндекс ID > Google, не использовать Firebase)
- Бэкенд первичен — это API-first проект, клиенты добавляются по очереди (Web → iOS → Android)
