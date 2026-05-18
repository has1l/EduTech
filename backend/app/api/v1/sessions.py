from fastapi import APIRouter
from sqlalchemy import select, update

from app.core.deps import CurrentUser, DbSession, RedisClient
from app.models.progress import UserTopicProgress
from app.models.topic import Topic
from app.schemas.tasks import SessionPathOut, TodaySession
from app.services.task_service import complete_session, get_session_path, get_today_session

router = APIRouter()


@router.get("/path", response_model=SessionPathOut)
async def session_path(user: CurrentUser, db: DbSession) -> SessionPathOut:
    return await get_session_path(user, db)


@router.get("/today", response_model=TodaySession)
async def today_session(user: CurrentUser, db: DbSession, redis: RedisClient) -> TodaySession:
    return await get_today_session(user, db, redis)


@router.post("/{session_id}/complete")
async def finish_session(session_id: str, user: CurrentUser, db: DbSession) -> dict:
    await complete_session(session_id, user, db)
    return {"ok": True}


@router.post("/reset-path")
async def reset_path(user: CurrentUser, db: DbSession) -> dict:
    """Reset correct_count for completed subtopics of the user's current exam type."""
    from app.models.subject import Subject
    is_oge = (getattr(user, "grade", None) or 11) <= 9
    subject_code = "math_oge" if is_oge else "math_ege"
    subj = await db.scalar(select(Subject).where(Subject.code == subject_code))
    topic_ids = (await db.execute(
        select(Topic.id).where(Topic.subject_id == subj.id)
    )).scalars().all() if subj else []

    await db.execute(
        update(UserTopicProgress)
        .where(
            UserTopicProgress.user_id == user.id,
            UserTopicProgress.correct_count >= 5,
            UserTopicProgress.topic_id.in_(topic_ids),
        )
        .values(correct_count=0, attempts_count=0, status="red")
    )
    await db.commit()
    return {"ok": True}
