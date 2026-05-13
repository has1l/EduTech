"""
Lazy-loads tasks from bank-ege.ru public API into our DB on demand.
Called by task_service when there are not enough local tasks for today's session.
"""
import re
import random
from uuid import uuid4, UUID

import httpx
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.subject import Subject
from app.models.task import Task
from app.models.topic import Topic

_API = "https://new-api.bank-ege.ru/api"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Origin": "https://bank-ege.ru",
}
_DEFAULT_SUBJECT_ID = 27          # Математика ОГЭ
_DEFAULT_SUBJECT_CODE = "math_oge"
_DEFAULT_SUBJECT_TITLE = "Математика ОГЭ"
_USED_VARIANTS_KEY = "bank_ege:used_variants"


def _strip_html(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    return re.sub(r"\s+", " ", text).strip()


def _extract_image(html: str) -> str | None:
    m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', html)
    return m.group(1) if m else None


def _difficulty(raw: int, number: int) -> int:
    if raw >= 2 or number > 12:
        return 3
    if raw == 1 or number > 6:
        return 2
    return 1


async def _ensure_subject(db: AsyncSession) -> UUID:
    subj = await db.scalar(select(Subject).where(Subject.code == _DEFAULT_SUBJECT_CODE))
    if subj is None:
        subj = Subject(id=uuid4(), code=_DEFAULT_SUBJECT_CODE, title=_DEFAULT_SUBJECT_TITLE)
        db.add(subj)
        await db.flush()
    return subj.id


async def _ensure_topic(db: AsyncSession, subject_id: UUID, title: str, cache: dict) -> UUID:
    if title in cache:
        return cache[title]
    existing = await db.scalar(
        select(Topic).where(Topic.subject_id == subject_id, Topic.title == title)
    )
    if existing:
        cache[title] = existing.id
        return existing.id
    topic = Topic(
        id=uuid4(),
        subject_id=subject_id,
        code=re.sub(r"[^a-z0-9]+", "_", title.lower())[:64],
        title=title,
        weight_in_exam=1.0,
        difficulty=1,
    )
    db.add(topic)
    await db.flush()
    cache[title] = topic.id
    return topic.id


async def fetch_and_store_tasks(
    db: AsyncSession,
    redis: Redis,
    needed: int = 15,
) -> int:
    """
    Fetches tasks from a bank-ege.ru variant and stores new ones in DB.
    Returns the number of newly inserted tasks.
    """
    async with httpx.AsyncClient(headers=_HEADERS, timeout=20) as client:
        try:
            r = await client.get(f"{_API}/ege/exam_variants", params={"subject_id": _DEFAULT_SUBJECT_ID})
            r.raise_for_status()
            variants = r.json()
        except Exception:
            return 0

        if not variants:
            return 0

        # Pick a variant we haven't used yet; if all used, reset
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
        except Exception:
            return 0

    subject_id = await _ensure_subject(db)

    # Existing source IDs to skip
    existing_ids = set(
        await db.scalars(select(Task.source_id).where(Task.source_id.isnot(None)))
    )

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
        if len(question_text) < 5:
            continue

        topic_title = (
            (t.get("exam_topic") or {}).get("title")
            or (t.get("topic") or {}).get("title")
            or "Общее"
        )
        topic_id = await _ensure_topic(db, subject_id, topic_title, topic_cache)
        solution = _strip_html(t.get("comment") or "")

        db.add(Task(
            id=uuid4(),
            topic_id=topic_id,
            type="short_answer",
            question_text=question_text,
            question_image_url=_extract_image(html),
            options=None,
            correct_answer=correct,
            solution_steps={"steps": [solution]} if solution else None,
            typical_errors=None,
            theory_section_ids=[],
            difficulty=_difficulty(t.get("difficulty") or 0, t.get("number") or 1),
            source_id=src_id,
        ))
        existing_ids.add(src_id)
        inserted += 1

    if inserted:
        await db.flush()

    return inserted
