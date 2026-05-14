"""
Fetches tasks from bank-ege.ru public API into our DB on demand.
Supports ЕГЭ профильная математика, task 1, subtopics 1.1–1.10.
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

# Subtopics for Задание 1 (Простейшая планиметрия), sourced from bank-ege.ru
TASK1_SUBTOPICS = [
    {"bank_ege_topic_id": 2372, "code": "1.1", "title": "Тригонометрия в прямоугольном треугольнике"},
    {"bank_ege_topic_id": 2373, "code": "1.2", "title": "Углы и отрезки в прямоугольном треугольнике"},
    {"bank_ege_topic_id": 2374, "code": "1.3", "title": "Углы в треугольнике"},
    {"bank_ege_topic_id": 2375, "code": "1.4", "title": "Площадь треугольника"},
    {"bank_ege_topic_id": 2376, "code": "1.5", "title": "Углы и отрезки в четырехугольниках"},
    {"bank_ege_topic_id": 2377, "code": "1.6", "title": "Площади четырехугольников"},
    {"bank_ege_topic_id": 2378, "code": "1.7", "title": "Центральные и вписанные углы"},
    {"bank_ege_topic_id": 2379, "code": "1.8", "title": "Касательная, хорда, секущая"},
    {"bank_ege_topic_id": 2380, "code": "1.9", "title": "Вписанные окружности"},
    {"bank_ege_topic_id": 2381, "code": "1.10", "title": "Описанные окружности"},
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
    """Creates the EGE subject and task-1 subtopics in DB if they don't exist."""
    async with SessionLocal() as db:
        try:
            subj = await db.scalar(select(Subject).where(Subject.code == _EGE_SUBJECT_CODE))
            if subj is None:
                subj = Subject(id=uuid4(), code=_EGE_SUBJECT_CODE, title=_EGE_SUBJECT_TITLE)
                db.add(subj)
                await db.flush()

            subject_id: UUID = subj.id

            for st in TASK1_SUBTOPICS:
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
                        exam_task_number=1,
                        bank_ege_topic_id=st["bank_ege_topic_id"],
                    ))

            await db.commit()
            log.info("EGE subtopics seeded")
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
