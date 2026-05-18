import uuid
from datetime import datetime, timezone
from typing import TypedDict

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from app.core.deps import CurrentUser, DbSession
from app.models.booster import KnowledgeBaseItem
from app.models.task import Task
from app.models.topic import Topic

router = APIRouter()

_OGE_SUBJECT_CODE = "math_oge"
_EGE_SUBJECT_CODE = "math_ege"


async def _user_subject_id(user: CurrentUser, db: DbSession) -> uuid.UUID:
    from app.models.subject import Subject
    is_oge = (getattr(user, "grade", None) or 11) <= 9
    code = _OGE_SUBJECT_CODE if is_oge else _EGE_SUBJECT_CODE
    subj = await db.scalar(select(Subject).where(Subject.code == code))
    if subj is None:
        raise HTTPException(status_code=500, detail="Subject not found")
    return subj.id


class _Level(TypedDict):
    min: int
    name: str
    emoji: str
    next_at: int | None


LEVELS: list[_Level] = [
    {"min": 0,   "name": "Новичок", "emoji": "🌱", "next_at": 10},
    {"min": 10,  "name": "Ученик",  "emoji": "📖", "next_at": 25},
    {"min": 25,  "name": "Знаток",  "emoji": "🎯", "next_at": 50},
    {"min": 50,  "name": "Мастер",  "emoji": "⚡", "next_at": 100},
    {"min": 100, "name": "Эксперт", "emoji": "🏆", "next_at": None},
]


def _get_level(count: int) -> _Level:
    level = LEVELS[0]
    for lvl in LEVELS:
        if count >= lvl["min"]:
            level = lvl
    return level


class KBStats(BaseModel):
    count: int
    level_name: str
    level_emoji: str
    next_at: int | None
    level_min: int
    level_pct: int


class AddKBIn(BaseModel):
    task_id: str
    topic_id: str | None = None


@router.get("/stats", response_model=KBStats)
async def get_kb_stats(user: CurrentUser, db: DbSession) -> KBStats:
    subj_id = await _user_subject_id(user, db)
    rows = (await db.execute(
        select(KnowledgeBaseItem)
        .join(Task, Task.id == KnowledgeBaseItem.task_id)
        .join(Topic, Topic.id == Task.topic_id)
        .where(KnowledgeBaseItem.user_id == user.id)
        .where(Topic.subject_id == subj_id)
    )).scalars().all()
    count = len(rows)
    level = _get_level(count)
    next_at = level["next_at"]
    level_min = level["min"]
    pct = (
        round((count - level_min) / (next_at - level_min) * 100)
        if next_at is not None and next_at > level_min
        else 100
    )
    return KBStats(
        count=count,
        level_name=level["name"],
        level_emoji=level["emoji"],
        next_at=next_at,
        level_min=level_min,
        level_pct=pct,
    )


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
async def add_to_kb(body: AddKBIn, user: CurrentUser, db: DbSession) -> None:
    task_uuid = uuid.UUID(body.task_id)
    topic_uuid = uuid.UUID(body.topic_id) if body.topic_id else None
    stmt = (
        insert(KnowledgeBaseItem)
        .values(
            user_id=user.id,
            task_id=task_uuid,
            topic_id=topic_uuid,
            solved_at=datetime.now(timezone.utc),
        )
        .on_conflict_do_nothing(constraint="uq_kb_user_task")
    )
    await db.execute(stmt)
    await db.commit()


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_kb(task_id: str, user: CurrentUser, db: DbSession) -> None:
    await db.execute(
        delete(KnowledgeBaseItem)
        .where(KnowledgeBaseItem.user_id == user.id)
        .where(KnowledgeBaseItem.task_id == uuid.UUID(task_id))
    )
    await db.commit()


@router.post("/clear", status_code=status.HTTP_204_NO_CONTENT)
async def clear_kb(user: CurrentUser, db: DbSession) -> None:
    await db.execute(
        delete(KnowledgeBaseItem).where(KnowledgeBaseItem.user_id == user.id)
    )
    await db.commit()
