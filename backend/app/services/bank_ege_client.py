"""
Fetches tasks from bank-ege.ru public API into our DB on demand.
Supports ЕГЭ профильная математика, tasks 1–12 with all subtopics.
"""
import html as html_mod
import logging
import random
import re
from uuid import UUID, uuid4

import httpx
from redis.asyncio import Redis
from sqlalchemy import select

from app.core.db import SessionLocal
from app.models.subject import Subject
from app.models.task import Task
from app.models.topic import Topic

log = logging.getLogger(__name__)

_API = "https://new-api.bank-ege.ru/api"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Origin": "https://bank-ege.ru",
}

_EGE_SUBJECT_ID = 19
_EGE_SUBJECT_CODE = "math_ege"
_EGE_SUBJECT_TITLE = "Математика ЕГЭ (Профильная)"

# Section metadata: title and difficulty level (1=green 2=yellow 3=red)
TASK_SECTIONS: dict[int, dict] = {
    1:  {"title": "Простейшая планиметрия",         "difficulty": 1},
    2:  {"title": "Векторы",                         "difficulty": 1},
    3:  {"title": "Стереометрия",                    "difficulty": 2},
    4:  {"title": "Вероятность (классическая)",       "difficulty": 1},
    5:  {"title": "Вероятность (сложная)",            "difficulty": 2},
    6:  {"title": "Простейшие уравнения",             "difficulty": 2},
    7:  {"title": "Преобразование выражений",         "difficulty": 2},
    8:  {"title": "Производная и интеграл",           "difficulty": 2},
    9:  {"title": "Уравнения и неравенства",          "difficulty": 2},
    10: {"title": "Текстовые задачи",                 "difficulty": 2},
    11: {"title": "Функции и графики",                "difficulty": 2},
    12: {"title": "Исследование функции",             "difficulty": 3},
}

# All subtopics for tasks 1–12, sourced from bank-ege.ru subject_id=19
ALL_EGE_SUBTOPICS = [
    # Задание 1 — Планиметрия
    {"bank_ege_topic_id": 2372, "code": "1.1",  "title": "Тригонометрия в прямоугольном треугольнике",        "exam_task_number": 1},
    {"bank_ege_topic_id": 2373, "code": "1.2",  "title": "Углы и отрезки в прямоугольном треугольнике",       "exam_task_number": 1},
    {"bank_ege_topic_id": 2374, "code": "1.3",  "title": "Углы в треугольнике",                                "exam_task_number": 1},
    {"bank_ege_topic_id": 2375, "code": "1.4",  "title": "Площадь треугольника",                              "exam_task_number": 1},
    {"bank_ege_topic_id": 2376, "code": "1.5",  "title": "Углы и отрезки в четырёхугольниках",                "exam_task_number": 1},
    {"bank_ege_topic_id": 2377, "code": "1.6",  "title": "Площади четырёхугольников",                         "exam_task_number": 1},
    {"bank_ege_topic_id": 2378, "code": "1.7",  "title": "Центральные и вписанные углы",                      "exam_task_number": 1},
    {"bank_ege_topic_id": 2379, "code": "1.8",  "title": "Касательная, хорда, секущая",                       "exam_task_number": 1},
    {"bank_ege_topic_id": 2380, "code": "1.9",  "title": "Вписанные окружности",                              "exam_task_number": 1},
    {"bank_ege_topic_id": 2381, "code": "1.10", "title": "Описанные окружности",                              "exam_task_number": 1},
    # Задание 2 — Векторы
    {"bank_ege_topic_id": 2382, "code": "2.1",  "title": "Сумма и разность векторов, умножение вектора на число", "exam_task_number": 2},
    {"bank_ege_topic_id": 2383, "code": "2.2",  "title": "Скалярное произведение векторов",                   "exam_task_number": 2},
    # Задание 3 — Стереометрия
    {"bank_ege_topic_id": 2384, "code": "3.1",  "title": "Отрезки в объёмных фигурах",                        "exam_task_number": 3},
    {"bank_ege_topic_id": 2385, "code": "3.2",  "title": "Углы в объёмных фигурах",                           "exam_task_number": 3},
    {"bank_ege_topic_id": 2386, "code": "3.3",  "title": "Тригонометрические функции в объёмных фигурах",     "exam_task_number": 3},
    {"bank_ege_topic_id": 2387, "code": "3.4",  "title": "Диагональ прямоугольного параллелепипеда",          "exam_task_number": 3},
    {"bank_ege_topic_id": 2388, "code": "3.5",  "title": "Площадь поверхности составного многогранника",      "exam_task_number": 3},
    {"bank_ege_topic_id": 2389, "code": "3.6",  "title": "Объём составного многогранника",                    "exam_task_number": 3},
    {"bank_ege_topic_id": 2390, "code": "3.7",  "title": "Формулы площади поверхности",                       "exam_task_number": 3},
    {"bank_ege_topic_id": 2391, "code": "3.8",  "title": "Площадь сечения",                                   "exam_task_number": 3},
    {"bank_ege_topic_id": 2392, "code": "3.9",  "title": "Формулы объёмов",                                   "exam_task_number": 3},
    # Задание 4 — Вероятность (классическая)
    {"bank_ege_topic_id": 2393, "code": "4.1",  "title": "Классическое определение вероятности",              "exam_task_number": 4},
    {"bank_ege_topic_id": 2394, "code": "4.2",  "title": "Теоремы вероятностей",                              "exam_task_number": 4},
    # Задание 5 — Вероятность (сложная)
    {"bank_ege_topic_id": 2449, "code": "5.1",  "title": "Классическое определение вероятности",              "exam_task_number": 5},
    {"bank_ege_topic_id": 2396, "code": "5.2",  "title": "Сумма несовместных событий (сумма произведений)",   "exam_task_number": 5},
    {"bank_ege_topic_id": 2397, "code": "5.3",  "title": "Сумма совместных событий",                          "exam_task_number": 5},
    {"bank_ege_topic_id": 2398, "code": "5.4",  "title": "Произведение событий",                              "exam_task_number": 5},
    # Задание 6 — Уравнения
    {"bank_ege_topic_id": 2399, "code": "6.1",  "title": "Степенные",                                         "exam_task_number": 6},
    {"bank_ege_topic_id": 2400, "code": "6.2",  "title": "Дробно-рациональные",                               "exam_task_number": 6},
    {"bank_ege_topic_id": 2401, "code": "6.3",  "title": "Иррациональные",                                    "exam_task_number": 6},
    {"bank_ege_topic_id": 2402, "code": "6.4",  "title": "Показательные",                                     "exam_task_number": 6},
    {"bank_ege_topic_id": 2403, "code": "6.5",  "title": "Логарифмические",                                   "exam_task_number": 6},
    {"bank_ege_topic_id": 2404, "code": "6.6",  "title": "Смешанные",                                         "exam_task_number": 6},
    # Задание 7 — Преобразование выражений
    {"bank_ege_topic_id": 2405, "code": "7.1",  "title": "Тригонометрические формулы приведения",             "exam_task_number": 7},
    {"bank_ege_topic_id": 2406, "code": "7.2",  "title": "Тригонометрические формулы двойного угла",          "exam_task_number": 7},
    {"bank_ege_topic_id": 2407, "code": "7.3",  "title": "Вычисление значений тригонометрических функций",    "exam_task_number": 7},
    {"bank_ege_topic_id": 2408, "code": "7.4",  "title": "Тригонометрические тождества",                      "exam_task_number": 7},
    {"bank_ege_topic_id": 2409, "code": "7.5",  "title": "Свойства логарифма",                                "exam_task_number": 7},
    {"bank_ege_topic_id": 2410, "code": "7.6",  "title": "Свойства арифметического корня",                    "exam_task_number": 7},
    {"bank_ege_topic_id": 2411, "code": "7.7",  "title": "Свойства степеней",                                 "exam_task_number": 7},
    # Задание 8 — Производная и интеграл
    {"bank_ege_topic_id": 2412, "code": "8.1",  "title": "Промежутки возрастания/убывания функции",           "exam_task_number": 8},
    {"bank_ege_topic_id": 2413, "code": "8.2",  "title": "Точки экстремумов функции",                         "exam_task_number": 8},
    {"bank_ege_topic_id": 2414, "code": "8.3",  "title": "Значение производной в точке",                      "exam_task_number": 8},
    {"bank_ege_topic_id": 2415, "code": "8.4",  "title": "Наибольшее/наименьшее значение функции на промежутке", "exam_task_number": 8},
    {"bank_ege_topic_id": 2416, "code": "8.5",  "title": "Геометрический смысл производной",                  "exam_task_number": 8},
    {"bank_ege_topic_id": 2417, "code": "8.6",  "title": "Физический смысл производной",                      "exam_task_number": 8},
    {"bank_ege_topic_id": 2418, "code": "8.7",  "title": "График первообразной",                              "exam_task_number": 8},
    {"bank_ege_topic_id": 2419, "code": "8.8",  "title": "Вычисление площади под графиком",                   "exam_task_number": 8},
    {"bank_ege_topic_id": 2420, "code": "8.9",  "title": "Поиск коэффициентов",                               "exam_task_number": 8},
    # Задание 9 — Уравнения и неравенства
    {"bank_ege_topic_id": 2421, "code": "9.1",  "title": "Дробно-рациональные уравнения и неравенства",       "exam_task_number": 9},
    {"bank_ege_topic_id": 2422, "code": "9.2",  "title": "Иррациональные уравнения и неравенства",            "exam_task_number": 9},
    {"bank_ege_topic_id": 2423, "code": "9.3",  "title": "Показательные уравнения и неравенства",             "exam_task_number": 9},
    {"bank_ege_topic_id": 2424, "code": "9.4",  "title": "Логарифмические уравнения и неравенства",           "exam_task_number": 9},
    {"bank_ege_topic_id": 2425, "code": "9.5",  "title": "Тригонометрические уравнения и неравенства",        "exam_task_number": 9},
    {"bank_ege_topic_id": 2426, "code": "9.6",  "title": "Квадратные уравнения и неравенства",                "exam_task_number": 9},
    {"bank_ege_topic_id": 2427, "code": "9.7",  "title": "Степенные уравнения и неравенства",                 "exam_task_number": 9},
    # Задание 10 — Текстовые задачи
    {"bank_ege_topic_id": 2428, "code": "10.1", "title": "Движение по воде",                                  "exam_task_number": 10},
    {"bank_ege_topic_id": 2429, "code": "10.2", "title": "Движение по суше",                                  "exam_task_number": 10},
    {"bank_ege_topic_id": 2430, "code": "10.3", "title": "Средняя скорость",                                  "exam_task_number": 10},
    {"bank_ege_topic_id": 2431, "code": "10.4", "title": "Относительное движение",                            "exam_task_number": 10},
    {"bank_ege_topic_id": 2432, "code": "10.5", "title": "Работа",                                            "exam_task_number": 10},
    {"bank_ege_topic_id": 2433, "code": "10.6", "title": "Совместная работа",                                 "exam_task_number": 10},
    {"bank_ege_topic_id": 2434, "code": "10.7", "title": "Смеси, сплавы и растворы",                         "exam_task_number": 10},
    {"bank_ege_topic_id": 2435, "code": "10.8", "title": "Сухофрукты",                                        "exam_task_number": 10},
    {"bank_ege_topic_id": 2436, "code": "10.9", "title": "Проценты",                                          "exam_task_number": 10},
    # Задание 11 — Функции и графики
    {"bank_ege_topic_id": 2437, "code": "11.1", "title": "Линейная функция",                                  "exam_task_number": 11},
    {"bank_ege_topic_id": 2438, "code": "11.2", "title": "Квадратичная функция",                              "exam_task_number": 11},
    {"bank_ege_topic_id": 2439, "code": "11.3", "title": "Показательная функция",                             "exam_task_number": 11},
    {"bank_ege_topic_id": 2440, "code": "11.4", "title": "Логарифмическая функция",                           "exam_task_number": 11},
    {"bank_ege_topic_id": 2441, "code": "11.5", "title": "Гипербола",                                         "exam_task_number": 11},
    {"bank_ege_topic_id": 2442, "code": "11.6", "title": "Функция квадратного арифметического корня",         "exam_task_number": 11},
    {"bank_ege_topic_id": 2443, "code": "11.7", "title": "Поиск точки пересечения графиков",                  "exam_task_number": 11},
    # Задание 12 — Исследование функции
    {"bank_ege_topic_id": 2444, "code": "12.1", "title": "Степенная и иррациональная функция",                "exam_task_number": 12},
    {"bank_ege_topic_id": 2445, "code": "12.2", "title": "Логарифмическая функция",                           "exam_task_number": 12},
    {"bank_ege_topic_id": 2446, "code": "12.3", "title": "Дробно-рациональная функция",                       "exam_task_number": 12},
    {"bank_ege_topic_id": 2447, "code": "12.4", "title": "Тригонометрическая функция",                        "exam_task_number": 12},
    {"bank_ege_topic_id": 2448, "code": "12.5", "title": "Функция с экспонентой",                             "exam_task_number": 12},
]


def _strip_html(raw: str) -> str:
    t = re.sub(r"<br\s*/?>", "\n", raw, flags=re.IGNORECASE)
    t = re.sub(r"<li[^>]*>", "\n• ", t, flags=re.IGNORECASE)
    t = re.sub(r"</(p|div|h\d|tr|ul|ol)>", "\n", t, flags=re.IGNORECASE)
    t = re.sub(r"<(p|div|h\d)[^>]*>", "\n", t, flags=re.IGNORECASE)
    t = re.sub(r"<td[^>]*>|<th[^>]*>", " | ", t, flags=re.IGNORECASE)
    t = re.sub(r"<[^>]+>", "", t)
    t = html_mod.unescape(t)
    lines = [re.sub(r"[ \t]+", " ", line).strip() for line in t.split("\n")]
    return "\n".join(line for line in lines if line).strip()


def _extract_image(html: str) -> str | None:
    m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', html)
    if not m:
        return None
    src = m.group(1)
    return src if (src.startswith("http") or src.startswith("data:image")) else None


async def ensure_ege_subtopics_seeded() -> None:
    """Creates the EGE subject and all task 1–12 subtopics in DB if they don't exist."""
    async with SessionLocal() as db:
        try:
            subj = await db.scalar(select(Subject).where(Subject.code == _EGE_SUBJECT_CODE))
            if subj is None:
                subj = Subject(id=uuid4(), code=_EGE_SUBJECT_CODE, title=_EGE_SUBJECT_TITLE)
                db.add(subj)
                await db.flush()

            subject_id: UUID = subj.id

            for st in ALL_EGE_SUBTOPICS:
                existing = await db.scalar(
                    select(Topic).where(
                        Topic.subject_id == subject_id,
                        Topic.bank_ege_topic_id == st["bank_ege_topic_id"],
                    )
                )
                if existing is None:
                    db.add(Topic(
                        id=uuid4(),
                        subject_id=subject_id,
                        code=st["code"],
                        title=st["title"],
                        weight_in_exam=1.0,
                        difficulty=2,
                        exam_task_number=st["exam_task_number"],
                        bank_ege_topic_id=st["bank_ege_topic_id"],
                    ))

            await db.commit()
            log.info("EGE subtopics seeded (tasks 1–12)")
        except Exception as exc:
            log.exception("EGE subtopics seed failed: %s", exc)
            await db.rollback()


async def fetch_tasks_for_subtopic(
    bank_ege_topic_id: int,
    exam_task_number: int,
    topic_id: UUID,
    needed: int = 10,
) -> int:
    """
    Fetches tasks for a specific EGE subtopic from bank-ege.ru.
    Returns number of newly inserted tasks.
    """
    async with httpx.AsyncClient(headers=_HEADERS, timeout=20) as client:
        try:
            r = await client.get(
                f"{_API}/ege/exam_tasks",
                params={
                    "number": exam_task_number,
                    "exam_topic_id": bank_ege_topic_id,
                    "is_obsolete": 0,
                },
            )
            r.raise_for_status()
            payload = r.json()
        except Exception as exc:
            log.warning("bank-ege exam_tasks fetch failed: %s", exc)
            return 0

    raw_tasks = payload.get("data", []) if isinstance(payload, dict) else payload
    if not isinstance(raw_tasks, list) or not raw_tasks:
        return 0

    random.shuffle(raw_tasks)

    async with SessionLocal() as db:
        try:
            rows = await db.scalars(select(Task.source_id).where(Task.source_id.isnot(None)))
            existing_ids: set[str] = set(rows.all())

            inserted = 0
            for t in raw_tasks:
                if inserted >= needed:
                    break

                src_id = f"ege_{t.get('id', '')}"
                if not src_id or src_id in existing_ids:
                    continue

                q = t.get("task_question") or {}
                answers = q.get("answers") or []
                correct = str(answers[0].get("answer", "")).strip() if answers else ""
                if not correct:
                    continue

                html = q.get("description") or ""
                question_text = _strip_html(html)
                image_url = _extract_image(html)
                if len(question_text) < 15 and not image_url:
                    continue
                if (question_text.endswith("...") or question_text.endswith("…")) and not image_url:
                    continue

                solution = _strip_html(t.get("comment") or "")
                db.add(Task(
                    id=uuid4(),
                    topic_id=topic_id,
                    type="short_answer",
                    question_text=question_text,
                    question_image_url=image_url,
                    options=None,
                    correct_answer=correct,
                    solution_steps={"steps": [solution]} if solution else None,
                    typical_errors=None,
                    theory_section_ids=[],
                    difficulty=2,
                    source_id=src_id,
                ))
                existing_ids.add(src_id)
                inserted += 1

            if inserted:
                await db.commit()
                log.info("bank-ege subtopic %d: inserted %d tasks", bank_ege_topic_id, inserted)
            return inserted

        except Exception as exc:
            log.exception("bank-ege subtopic DB store failed: %s", exc)
            await db.rollback()
            return 0


# EGE variants with full task 1–12 coverage (confirmed manually)
_DIAGNOSTIC_VARIANT_UUIDS = [
    "4ac2caa8-1258-4b22-bff1-b424bc5553ac",  # variant 39200
    "f0783d46-26fb-4b98-9b49-9f5dffefe850",  # variant 54021
    "a957f9ff-061e-4a99-979c-2b64a1ea81aa",  # variant 94584
    "4ddf234a-7ae4-469d-ac49-3b308c492131",  # variant 107842
    "82fec9d5-38da-41f1-a8b2-ef8617ed28ac",  # variant 113909
]


async def fetch_and_store_ege_variant(db) -> list[Task]:
    """
    Picks a random EGE variant with full task 1–12 coverage,
    imports tasks to DB, returns Task list ordered by task number.
    """
    from sqlalchemy.ext.asyncio import AsyncSession as _AS
    variant_uuid = random.choice(_DIAGNOSTIC_VARIANT_UUIDS)

    async with httpx.AsyncClient(headers=_HEADERS, timeout=20) as client:
        try:
            r = await client.get(f"{_API}/ege/exam_variants/{variant_uuid}/tasks")
            r.raise_for_status()
            raw_tasks = r.json()
        except Exception as exc:
            log.warning("bank-ege variant fetch failed: %s", exc)
            return []

    if not isinstance(raw_tasks, list):
        return []

    # Filter part 1 (tasks 1–12 with written answers), deduplicate by number
    seen: dict[int, dict] = {}
    for t in raw_tasks:
        n = t.get("number", 99)
        if n <= 12 and (t.get("task_question") or {}).get("answers") and n not in seen:
            seen[n] = t

    subj = await db.scalar(select(Subject).where(Subject.code == _EGE_SUBJECT_CODE))
    if subj is None:
        return []

    topic_rows = await db.scalars(select(Topic).where(Topic.subject_id == subj.id))
    topic_by_bank_id: dict[int, Topic] = {
        t.bank_ege_topic_id: t for t in topic_rows.all() if t.bank_ege_topic_id
    }

    rows = await db.scalars(select(Task.source_id).where(Task.source_id.isnot(None)))
    existing_src: set[str] = set(rows.all())

    result: list[Task] = []
    new_added = False

    for task_num in sorted(seen.keys()):
        raw = seen[task_num]
        src_id = f"ege_{raw['id']}"

        if src_id in existing_src:
            existing = await db.scalar(select(Task).where(Task.source_id == src_id))
            if existing:
                result.append(existing)
                continue

        q = raw.get("task_question") or {}
        answers = q.get("answers") or []
        correct = str(answers[0].get("answer", "")).strip() if answers else ""
        if not correct:
            continue

        html = q.get("description") or ""
        question_text = _strip_html(html)
        image_url = _extract_image(html)
        if len(question_text) < 5 and not image_url:
            continue

        bank_topic_id = (raw.get("exam_topic") or {}).get("id")
        topic = topic_by_bank_id.get(bank_topic_id) if bank_topic_id else None
        if topic is None:
            for st in ALL_EGE_SUBTOPICS:
                if st["exam_task_number"] == task_num:
                    topic = topic_by_bank_id.get(st["bank_ege_topic_id"])
                    if topic:
                        break
        if topic is None:
            continue

        solution = _strip_html(raw.get("comment") or "")
        new_task = Task(
            id=uuid4(),
            topic_id=topic.id,
            type="short_answer",
            question_text=question_text,
            question_image_url=image_url,
            options=None,
            correct_answer=correct,
            solution_steps={"steps": [solution]} if solution else None,
            typical_errors=None,
            theory_section_ids=[],
            difficulty=2,
            source_id=src_id,
        )
        db.add(new_task)
        existing_src.add(src_id)
        result.append(new_task)
        new_added = True

    if new_added:
        await db.flush()

    return result


# Legacy: fetch a full OGE variant (kept for backward compat, unused in new flow)
_OGE_SUBJECT_ID = 27
_OGE_SUBJECT_CODE = "math_oge"
_OGE_SUBJECT_TITLE = "Математика ОГЭ"
_USED_VARIANTS_KEY = "bank_ege:used_variants"


async def fetch_and_store_tasks(redis: Redis, needed: int = 15) -> int:
    async with httpx.AsyncClient(headers=_HEADERS, timeout=20) as client:
        try:
            r = await client.get(
                f"{_API}/ege/exam_variants",
                params={"subject_id": _OGE_SUBJECT_ID},
            )
            r.raise_for_status()
            variants = r.json()
        except Exception as exc:
            log.warning("bank-ege variants fetch failed: %s", exc)
            return 0

        if not variants:
            return 0

        used = await redis.smembers(_USED_VARIANTS_KEY)
        unused = [v for v in variants if v["uuid"].encode() not in used]
        if not unused:
            await redis.delete(_USED_VARIANTS_KEY)
            unused = variants

        variant = random.choice(unused)
        await redis.sadd(_USED_VARIANTS_KEY, variant["uuid"])

        try:
            r = await client.get(f"{_API}/ege/exam_variants/{variant['uuid']}/tasks")
            r.raise_for_status()
            raw_tasks = r.json()
        except Exception as exc:
            log.warning("bank-ege tasks fetch failed: %s", exc)
            return 0

    if not isinstance(raw_tasks, list):
        return 0

    async with SessionLocal() as db:
        try:
            subj = await db.scalar(select(Subject).where(Subject.code == _OGE_SUBJECT_CODE))
            if subj is None:
                subj = Subject(id=uuid4(), code=_OGE_SUBJECT_CODE, title=_OGE_SUBJECT_TITLE)
                db.add(subj)
                await db.flush()
            subject_id: UUID = subj.id

            rows = await db.scalars(select(Task.source_id).where(Task.source_id.isnot(None)))
            existing_ids: set[str] = set(rows.all())

            topic_cache: dict[str, UUID] = {}
            inserted = 0

            for t in raw_tasks:
                if inserted >= needed:
                    break

                src_id = str(t.get("id", ""))
                if not src_id or src_id in existing_ids:
                    continue

                q = t.get("task_question") or {}
                answers = q.get("answers") or []
                correct = str(answers[0].get("answer", "")).strip() if answers else ""
                if not correct:
                    continue

                html = q.get("description") or ""
                question_text = _strip_html(html)
                image_url = _extract_image(html)
                if len(question_text) < 15 and not image_url:
                    continue
                if (question_text.endswith("...") or question_text.endswith("…")) and not image_url:
                    continue

                topic_title = (
                    (t.get("exam_topic") or {}).get("title")
                    or (t.get("topic") or {}).get("title")
                    or "Общее"
                )

                if topic_title in topic_cache:
                    topic_id = topic_cache[topic_title]
                else:
                    existing_topic = await db.scalar(
                        select(Topic).where(
                            Topic.subject_id == subject_id,
                            Topic.title == topic_title,
                        )
                    )
                    if existing_topic:
                        topic_id = existing_topic.id
                    else:
                        new_topic = Topic(
                            id=uuid4(),
                            subject_id=subject_id,
                            code=re.sub(r"[^a-z0-9]+", "_", topic_title.lower())[:64],
                            title=topic_title,
                            weight_in_exam=1.0,
                            difficulty=1,
                        )
                        db.add(new_topic)
                        await db.flush()
                        topic_id = new_topic.id
                    topic_cache[topic_title] = topic_id

                solution = _strip_html(t.get("comment") or "")
                db.add(Task(
                    id=uuid4(),
                    topic_id=topic_id,
                    type="short_answer",
                    question_text=question_text,
                    question_image_url=image_url,
                    options=None,
                    correct_answer=correct,
                    solution_steps={"steps": [solution]} if solution else None,
                    typical_errors=None,
                    theory_section_ids=[],
                    difficulty=2,
                    source_id=src_id,
                ))
                existing_ids.add(src_id)
                inserted += 1

            if inserted:
                await db.commit()
                log.info("bank-ege OGE: inserted %d tasks", inserted)
            return inserted

        except Exception as exc:
            log.exception("bank-ege OGE DB store failed: %s", exc)
            await db.rollback()
            return 0
