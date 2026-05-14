from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession, RedisClient
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
