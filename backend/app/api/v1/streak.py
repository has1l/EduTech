from datetime import date

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


@router.post("/record", response_model=StreakOut)
async def record_streak(user: CurrentUser, db: DbSession) -> StreakOut:
    """Call after any correct answer — increments streak at most once per day."""
    today = date.today()
    streak = await db.get(Streak, user.id)

    if streak is None:
        streak = Streak(
            user_id=user.id,
            current_streak=1,
            longest_streak=1,
            last_session_date=today,
            freezes_available=2,
        )
        db.add(streak)
        await db.commit()
    elif streak.last_session_date != today:
        yesterday = date.fromordinal(today.toordinal() - 1)
        day_before = date.fromordinal(today.toordinal() - 2)

        if streak.last_session_date == yesterday:
            streak.current_streak += 1
        elif streak.last_session_date == day_before and streak.freezes_available > 0:
            streak.freezes_available -= 1
        else:
            streak.current_streak = 1

        streak.last_session_date = today
        if streak.current_streak > streak.longest_streak:
            streak.longest_streak = streak.current_streak

        await db.commit()

    return StreakOut(
        current_streak=streak.current_streak,
        longest_streak=streak.longest_streak,
        last_session_date=str(streak.last_session_date),
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
