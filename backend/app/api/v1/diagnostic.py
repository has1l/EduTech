import json
import logging
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser, DbSession, RedisClient
from app.models.attempt import Attempt
from app.models.task import Task
from app.models.topic import Topic
from app.schemas.diagnostic import (
    DiagnosticResultOut,
    DiagnosticStartOut,
    DiagnosticSubmitIn,
    SectionResult,
)
from app.schemas.tasks import TaskOut
from app.services.bank_ege_client import OGE_TASK_SECTIONS, TASK_SECTIONS, fetch_and_store_ege_variant, fetch_and_store_oge_variant
from sqlalchemy import select

router = APIRouter()
log = logging.getLogger(__name__)

_SESSION_PREFIX = "diagnostic:"
_SESSION_TTL = 60 * 60 * 2  # 2 hours


@router.post("/start", response_model=DiagnosticStartOut)
async def start_diagnostic(
    user: CurrentUser,
    db: DbSession,
    redis: RedisClient,
) -> DiagnosticStartOut:
    from app.models.user import User as UserModel
    db_user = await db.get(UserModel, user.id)
    is_oge = (getattr(db_user, "grade", None) or 11) <= 9

    if is_oge:
        tasks = await fetch_and_store_oge_variant(db)
    else:
        tasks = await fetch_and_store_ege_variant(db)

    if not tasks:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Не удалось загрузить задания для диагностики",
        )

    await db.commit()

    session_id = f"diag:{user.id}:{uuid4().hex[:8]}"
    task_ids = [str(t.id) for t in tasks]
    await redis.setex(f"{_SESSION_PREFIX}{session_id}", _SESSION_TTL, json.dumps(task_ids))

    return DiagnosticStartOut(
        session_id=session_id,
        tasks=[TaskOut.model_validate(t) for t in tasks],
    )


@router.post("/submit", response_model=DiagnosticResultOut)
async def submit_diagnostic(
    body: DiagnosticSubmitIn,
    user: CurrentUser,
    db: DbSession,
    redis: RedisClient,
) -> DiagnosticResultOut:
    cached = await redis.get(f"{_SESSION_PREFIX}{body.session_id}")
    if not cached:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сессия диагностики не найдена или истекла",
        )

    task_ids: list[str] = json.loads(cached)
    answer_map = {str(a.task_id): a.answer for a in body.answers}

    sections: list[SectionResult] = []
    correct_total = 0

    for task_id_str in task_ids:
        task = await db.get(Task, UUID(task_id_str))
        if task is None:
            continue

        user_answer = answer_map.get(task_id_str, "")
        is_correct = (
            _normalize(user_answer) == _normalize(task.correct_answer)
            if user_answer
            else False
        )

        if user_answer:
            db.add(
                Attempt(
                    user_id=user.id,
                    task_id=task.id,
                    user_answer=user_answer,
                    is_correct=is_correct,
                    time_spent_sec=None,
                )
            )

        if is_correct:
            correct_total += 1

        topic = await db.get(Topic, task.topic_id)
        task_num = topic.exam_task_number if topic else 0
        meta = (
            TASK_SECTIONS.get(task_num or 0)
            or OGE_TASK_SECTIONS.get(task_num or 0)
            or {"title": f"Задание {task_num}", "difficulty": 2}
        )

        sections.append(
            SectionResult(
                task_number=task_num or 0,
                title=meta["title"],
                difficulty=meta["difficulty"],
                is_correct=is_correct,
                correct_answer=task.correct_answer,
                topic_title=topic.title if topic else "",
            )
        )

    from app.models.user import User
    db_user = await db.get(User, user.id)
    if db_user is not None:
        db_user.diagnostic_completed_at = datetime.now(timezone.utc)

    await db.commit()
    await redis.delete(f"{_SESSION_PREFIX}{body.session_id}")

    sections.sort(key=lambda s: s.task_number)

    return DiagnosticResultOut(
        total=len(sections),
        correct=correct_total,
        sections=sections,
    )


def _normalize(s: str) -> str:
    return s.strip().replace(",", ".").upper()
