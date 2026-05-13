import json
import logging
from datetime import date
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import Attempt
from app.models.dialogue import AIDialogue
from app.models.streak import Streak
from app.models.task import Task
from app.models.theory import TheorySection
from app.models.user import User
from app.schemas.tasks import AnswerResult, TaskOut, TodaySession
from app.services.bank_ege_client import fetch_and_store_tasks

log = logging.getLogger(__name__)

_SESSION_TTL = 60 * 60 * 20  # 20 hours


def _today_key(user_id: UUID) -> str:
    return f"today_tasks:{user_id}:{date.today()}"


async def get_task(task_id: UUID, db: AsyncSession) -> Task | None:
    return await db.get(Task, task_id)


async def process_answer(
    task_id: UUID,
    user: User,
    answer: str,
    time_spent_sec: int | None,
    db: AsyncSession,
) -> AnswerResult:
    task = await db.get(Task, task_id)
    if task is None:
        return AnswerResult(correct=False)

    def _normalize(s: str) -> str:
        return s.strip().replace(",", ".").upper()

    is_correct = _normalize(answer) == _normalize(task.correct_answer)

    attempt = Attempt(
        user_id=user.id,
        task_id=task_id,
        user_answer=answer,
        is_correct=is_correct,
        time_spent_sec=time_spent_sec,
    )
    db.add(attempt)
    await db.flush()

    dialogue_id = None
    if not is_correct:
        dialogue = AIDialogue(attempt_id=attempt.id, messages=[], hint_level=1)
        db.add(dialogue)
        await db.flush()
        dialogue_id = dialogue.id

    await db.commit()
    return AnswerResult(correct=is_correct, dialogue_id=dialogue_id)


async def get_today_session(user: User, db: AsyncSession, redis: Redis) -> TodaySession:
    cache_key = _today_key(user.id)
    cached = await redis.get(cache_key)

    done_today = await db.scalars(
        select(Attempt.task_id).where(
            Attempt.user_id == user.id,
            func.date(Attempt.created_at) == date.today(),
        )
    )
    done_ids = set(done_today.all())

    if cached:
        task_ids = json.loads(cached)
        tasks_q = await db.execute(select(Task).where(Task.id.in_(task_ids)))
        tasks = list(tasks_q.scalars().all())
        tasks.sort(key=lambda t: task_ids.index(str(t.id)))
        # Cache had stale IDs (e.g. after migration) — fall through to rebuild
        if not tasks:
            await redis.delete(cache_key)
            cached = None

    if not cached:
        available = await db.scalars(
            select(Task).where(Task.id.notin_(done_ids)).limit(5)
        )
        tasks = list(available.all())

        if len(tasks) < 5:
            await fetch_and_store_tasks(redis, needed=15)
            available = await db.scalars(
                select(Task).where(Task.id.notin_(done_ids)).limit(5)
            )
            tasks = list(available.all())

        if tasks:
            task_ids = [str(t.id) for t in tasks]
            await redis.setex(cache_key, _SESSION_TTL, json.dumps(task_ids))

    session_id = f"{user.id}:{date.today()}"
    return TodaySession(
        session_id=session_id,
        tasks=[TaskOut.model_validate(t) for t in tasks],
    )


async def complete_session(session_id: str, user: User, db: AsyncSession) -> None:
    parts = session_id.split(":")
    if len(parts) != 2 or parts[0] != str(user.id):
        return

    today = date.today()
    streak = await db.get(Streak, user.id)
    if streak is None:
        streak = Streak(user_id=user.id, current_streak=1, longest_streak=1, last_session_date=today)
        db.add(streak)
        await db.commit()
        return

    if streak.last_session_date == today:
        return

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


async def load_dialogue_context(
    dialogue_id: UUID,
    user: User,
    db: AsyncSession,
) -> tuple[AIDialogue, Task, Attempt, TheorySection | None] | None:
    dialogue = await db.get(AIDialogue, dialogue_id)
    if dialogue is None:
        return None

    attempt = await db.get(Attempt, dialogue.attempt_id)
    if attempt is None or attempt.user_id != user.id:
        return None

    task = await db.get(Task, attempt.task_id)
    if task is None:
        return None

    theory = None
    if task.theory_section_ids:
        result = await db.scalars(
            select(TheorySection).where(
                TheorySection.id == UUID(task.theory_section_ids[0])
            )
        )
        theory = result.first()

    return dialogue, task, attempt, theory
