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
  code TEXT,                    -- "inscribed_angle"
  title TEXT,
  weight_in_exam FLOAT,
  difficulty INT
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

GET    /tasks/{id}
POST   /tasks/{id}/answer
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

## 17. Стиль работы

- Общение с пользователем (Родион) на русском, неформально, коротко
- Не писать комментариев в коде «что делает функция» — имена должны говорить сами
- Не делать преждевременных абстракций
- При выборе технологий учитывать российскую аудиторию (Яндекс ID > Google, не использовать Firebase)
- Бэкенд первичен — это API-first проект, клиенты добавляются по очереди (Web → iOS → Android)
