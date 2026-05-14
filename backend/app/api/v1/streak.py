from fastapi import APIRouter

from app.core.deps import CurrentUser, DbSession
from app.models.streak import Streak
from pydantic import BaseModel

router = APIRouter()


class StreakOut(BaseModel):
    current_streak: int
    longest_streak: int
    last_session_date: str | None
    freezes_available: int


@router.get("", response_model=StreakOut)
async def get_streak(user: CurrentUser, db: DbSession) -> StreakOut:
    streak = await db.get(Streak, user.id)
    if streak is None:
        return StreakOut(
            current_streak=0,
            longest_streak=0,
            last_session_date=None,
            freezes_available=2,
        )
    return StreakOut(
        current_streak=streak.current_streak,
        longest_streak=streak.longest_streak,
        last_session_date=str(streak.last_session_date) if streak.last_session_date else None,
        freezes_available=streak.freezes_available,
    )


@router.post("/freeze")
async def use_streak_freeze(user: CurrentUser, db: DbSession) -> dict:
    streak = await db.get(Streak, user.id)
    if streak is None or streak.freezes_available <= 0:
        return {"ok": False, "message": "Нет заморозок"}
    streak.freezes_available -= 1
    await db.commit()
    return {"ok": True, "freezes_available": streak.freezes_available}
