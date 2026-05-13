"""
Lazy-loads tasks from bank-ege.ru public API into our DB on demand.
Called by task_service when there are not enough local tasks for today's session.
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
_DEFAULT_SUBJECT_ID = 27
_DEFAULT_SUBJECT_CODE = "math_oge"
_DEFAULT_SUBJECT_TITLE = "Математика ОГЭ"
_USED_VARIANTS_KEY = "bank_ege:used_variants"


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


def _difficulty(raw: int, number: int) -> int:
    if raw >= 2 or number > 12:
        return 3
    if raw == 1 or number > 6:
        return 2
    return 1


async def fetch_and_store_tasks(redis: Redis, needed: int = 15) -> int:
    """
    Fetches one variant from bank-ege.ru and stores new tasks in DB.
    Uses its own DB session to avoid greenlet conflicts with the request session.
    Returns the number of newly inserted tasks.
    """
    # Step 1: fetch from bank-ege.ru (pure HTTP, no DB)
    async with httpx.AsyncClient(headers=_HEADERS, timeout=20) as client:
        try:
            r = await client.get(
                f"{_API}/ege/exam_variants",
                params={"subject_id": _DEFAULT_SUBJECT_ID},
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

    # Step 2: store in DB using a fresh dedicated session
    async with SessionLocal() as db:
        try:
            # Get or create subject
            subj = await db.scalar(
                select(Subject).where(Subject.code == _DEFAULT_SUBJECT_CODE)
            )
            if subj is None:
                subj = Subject(
                    id=uuid4(),
                    code=_DEFAULT_SUBJECT_CODE,
                    title=_DEFAULT_SUBJECT_TITLE,
                )
                db.add(subj)
                await db.flush()
            subject_id: UUID = subj.id

            # Existing source IDs to skip
            rows = await db.scalars(
                select(Task.source_id).where(Task.source_id.isnot(None))
            )
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

                # Get or create topic
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
                    difficulty=_difficulty(t.get("difficulty") or 0, t.get("number") or 1),
                    source_id=src_id,
                ))
                existing_ids.add(src_id)
                inserted += 1

            if inserted:
                await db.commit()
                log.info("bank-ege: inserted %d tasks", inserted)
            return inserted

        except Exception as exc:
            log.exception("bank-ege DB store failed: %s", exc)
            await db.rollback()
            return 0
