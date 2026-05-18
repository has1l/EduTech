from datetime import date

from fastapi import APIRouter
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import CurrentUser, DbSession, RedisClient
from app.models.streak import Streak
from pydantic import BaseModel

router = APIRouter()


class StreakOut(BaseModel):
    current_streak: int
    longest_streak: int
    last_session_date: str | None
    freezes_available: int


async def burn_if_expired(streak: Streak, db: AsyncSession) -> None:
    """Reset streak to 0 if the user missed more days than a freeze can cover."""
    if not streak.last_session_date or streak.current_streak == 0:
        return
    days_since = (date.today() - streak.last_session_date).days
    if days_since <= 1:
        return
    # A single freeze bridges exactly one missed day (days_since == 2)
    if days_since == 2 and streak.freezes_available > 0:
        return
    streak.current_streak = 0
    await db.commit()


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
    await burn_if_expired(streak, db)
    return StreakOut(
        current_streak=streak.current_streak,
        longest_streak=streak.longest_streak,
        last_session_date=str(streak.last_session_date) if streak.last_session_date else None,
        freezes_available=streak.freezes_available,
    )


@router.post("/record", response_model=StreakOut)
async def record_streak(user: CurrentUser, db: DbSession, redis: RedisClient) -> StreakOut:
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
        await burn_if_expired(streak, db)
        yesterday = date.fromordinal(today.toordinal() - 1)
        day_before = date.fromordinal(today.toordinal() - 2)

        if streak.last_session_date == yesterday:
            streak.current_streak += 1
        elif streak.last_session_date == day_before and streak.freezes_available > 0:
            streak.freezes_available -= 1
            # freeze bridges the gap; streak count unchanged, last_session_date advances
        else:
            streak.current_streak = 1

        streak.last_session_date = today
        if streak.current_streak > streak.longest_streak:
            streak.longest_streak = streak.current_streak

        await db.commit()

    await redis.delete(f"score_pred:{user.id}")

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
