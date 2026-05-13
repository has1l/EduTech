"""
Scrapes math tasks from bank-ege.ru public API and inserts them into our DB.

Usage:
    python scripts/scrape_bank_ege.py --subject oge_math --limit 200
    python scripts/scrape_bank_ege.py --subject ege_profil --limit 300

Subjects:
    oge_math   — Математика ОГЭ     (subject_id=27, ~2342 tasks)
    ege_profil — Профильная математика ЕГЭ (subject_id=19, ~2726 tasks)
    ege_base   — Базовая математика ЕГЭ   (subject_id=30, ~942 tasks)
"""
import argparse
import asyncio
import os
import re
import sys
from pathlib import Path
from uuid import UUID, uuid4

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import settings
from app.models.subject import Subject
from app.models.task import Task
from app.models.topic import Topic

API_BASE = "https://new-api.bank-ege.ru/api"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Origin": "https://bank-ege.ru",
    "Referer": "https://bank-ege.ru/",
}

SUBJECTS = {
    "oge_math": {"id": 27, "name": "Математика ОГЭ", "code": "math_oge"},
    "ege_profil": {"id": 19, "name": "Профильная математика", "code": "math_ege_profil"},
    "ege_base": {"id": 30, "name": "Базовая математика", "code": "math_ege_base"},
}


def strip_html(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def extract_image_url(html: str) -> str | None:
    m = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', html)
    return m.group(1) if m else None


def map_difficulty(raw: int, task_number: int) -> int:
    """Map bank-ege difficulty (0/1/2) + task number to our 1-3 scale."""
    if raw >= 2 or task_number > 12:
        return 3
    if raw == 1 or task_number > 6:
        return 2
    return 1


async def fetch_variants(client: httpx.AsyncClient, subject_id: int) -> list[dict]:
    r = await client.get(f"{API_BASE}/ege/exam_variants", params={"subject_id": subject_id})
    r.raise_for_status()
    return r.json()


async def fetch_variant_tasks(client: httpx.AsyncClient, uuid: str) -> list[dict]:
    r = await client.get(f"{API_BASE}/ege/exam_variants/{uuid}/tasks")
    r.raise_for_status()
    return r.json()


async def ensure_topic(db, subject_id: UUID, title: str, topic_cache: dict) -> UUID:
    if title in topic_cache:
        return topic_cache[title]
    existing = await db.scalar(
        select(Topic).where(Topic.subject_id == subject_id, Topic.title == title)
    )
    if existing:
        topic_cache[title] = existing.id
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
    topic_cache[title] = topic.id
    return topic.id


async def main(subject_key: str, limit: int) -> None:
    subj_meta = SUBJECTS[subject_key]
    engine = create_async_engine(settings.database_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as db:
        # Get or create subject
        subject = await db.scalar(
            select(Subject).where(Subject.code == subj_meta["code"])
        )
        if not subject:
            subject = Subject(id=uuid4(), code=subj_meta["code"], title=subj_meta["name"])
            db.add(subject)
            await db.flush()
        subject_id: UUID = subject.id

        # Existing task source IDs (to deduplicate)
        existing_sources = set(
            await db.scalars(
                select(Task.source_id).where(
                    Task.source_id.isnot(None),
                    Task.topic_id.in_(
                        select(Topic.id).where(Topic.subject_id == subject_id)
                    ),
                )
            )
        )

        topic_cache: dict[str, UUID] = {}
        inserted = 0
        seen_ids: set[int] = set()

        async with httpx.AsyncClient(headers=HEADERS, timeout=30) as client:
            variants = await fetch_variants(client, subj_meta["id"])
            print(f"Found {len(variants)} variants for {subj_meta['name']}")

            for variant in variants:
                if inserted >= limit:
                    break
                print(f"  Fetching variant {variant['uuid']} ...", end=" ", flush=True)
                try:
                    tasks = await fetch_variant_tasks(client, variant["uuid"])
                except Exception as e:
                    print(f"ERROR: {e}")
                    continue
                print(f"{len(tasks)} tasks")

                for t in tasks:
                    if inserted >= limit:
                        break
                    task_id = t.get("id")
                    if not task_id or task_id in seen_ids:
                        continue
                    seen_ids.add(task_id)

                    if str(task_id) in existing_sources:
                        continue

                    q = t.get("task_question") or {}
                    answers = q.get("answers") or []
                    if not answers:
                        continue
                    correct_answer = str(answers[0].get("answer", "")).strip()
                    if not correct_answer:
                        continue

                    description_html = q.get("description") or ""
                    question_text = strip_html(description_html)
                    if len(question_text) < 5:
                        continue

                    image_url = extract_image_url(description_html)
                    topic_title = (
                        (t.get("exam_topic") or {}).get("title")
                        or (t.get("topic") or {}).get("title")
                        or "Общее"
                    )
                    task_number = t.get("number") or 1
                    difficulty = map_difficulty(t.get("difficulty") or 0, task_number)
                    solution_html = t.get("comment") or ""
                    solution_text = strip_html(solution_html) if solution_html else None

                    topic_id = await ensure_topic(db, subject_id, topic_title, topic_cache)

                    task_obj = Task(
                        id=uuid4(),
                        topic_id=topic_id,
                        type="short_answer",
                        question_text=question_text,
                        question_image_url=image_url,
                        options=None,
                        correct_answer=correct_answer,
                        solution_steps={"steps": [solution_text]} if solution_text else None,
                        typical_errors=None,
                        theory_section_ids=[],
                        difficulty=difficulty,
                        source_id=str(task_id),
                    )
                    db.add(task_obj)
                    inserted += 1

        await db.commit()
        print(f"\nDone! Inserted {inserted} tasks.")
    await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--subject", default="oge_math", choices=list(SUBJECTS.keys()))
    parser.add_argument("--limit", type=int, default=200)
    args = parser.parse_args()
    asyncio.run(main(args.subject, args.limit))
