import json
import logging
import random
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
from app.models.topic import Topic
from app.schemas.tasks import AnswerResult, PathNodeOut, SessionPathOut, TaskOut, TodaySession
from app.services.bank_ege_client import (
    _EGE_SUBJECT_CODE,
    fetch_and_store_tasks,
    fetch_tasks_for_subtopic,
)

log = logging.getLogger(__name__)

_SESSION_TTL = 60 * 60 * 20  # 20 hours


def _today_key(user_id: UUID) -> str:
    return f"today_tasks:{user_id}:{date.today()}"


async def get_task(task_id: UUID, db: AsyncSession) -> Task | None:
    return await db.get(Task, task_id)


async def process_answer(
    task_id: UUID,
    user,
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


async def get_session_path(user, db: AsyncSession) -> SessionPathOut:
    """Returns the EGE task-1 subtopic path with user progress."""
    from app.models.subject import Subject

    subj = await db.scalar(select(Subject).where(Subject.code == _EGE_SUBJECT_CODE))
    if subj is None:
        return SessionPathOut(nodes=[])

    topics_result = await db.scalars(
        select(Topic)
        .where(Topic.subject_id == subj.id, Topic.exam_task_number == 1)
        .order_by(Topic.code)
    )
    topics = list(topics_result.all())

    if not topics:
        return SessionPathOut(nodes=[])

    topic_ids = [t.id for t in topics]

    # Count attempts per topic for this user
    rows = await db.execute(
        select(Task.topic_id, func.count(Attempt.id), func.sum(Attempt.is_correct.cast(type_=None)))
        .join(Attempt, Attempt.task_id == Task.id)
        .where(Attempt.user_id == user.id, Task.topic_id.in_(topic_ids))
        .group_by(Task.topic_id)
    )
    stats: dict[UUID, tuple[int, int]] = {}
    for topic_id, total, correct in rows:
        stats[topic_id] = (int(total), int(correct or 0))

    nodes: list[PathNodeOut] = []
    found_current = False

    for topic in topics:
        attempts_count, correct_count = stats.get(topic.id, (0, 0))
        is_completed = correct_count >= 1

        if is_completed:
            state = "completed"
        elif not found_current:
            state = "current"
            found_current = True
        else:
            state = "locked"

        nodes.append(PathNodeOut(
            topic_id=topic.id,
            title=topic.title,
            subtopic_number=topic.code,
            task_number=topic.exam_task_number or 1,
            state=state,
            attempts_count=attempts_count,
            correct_count=correct_count,
        ))

    return SessionPathOut(nodes=nodes)


async def get_random_task_for_topic(
    topic_id: UUID,
    user,
    db: AsyncSession,
    redis: Redis,
) -> Task | None:
    topic = await db.get(Topic, topic_id)
    if topic is None:
        return None

    # Tasks user already answered correctly for this topic
    done_correctly = await db.scalars(
        select(Attempt.task_id)
        .where(Attempt.user_id == user.id, Attempt.is_correct == True)  # noqa: E712
        .join(Task, Task.id == Attempt.task_id)
        .where(Task.topic_id == topic_id)
    )
    done_ids = set(done_correctly.all())

    # Prefer tasks not yet solved correctly
    available = await db.scalars(
        select(Task)
        .where(Task.topic_id == topic_id, Task.id.notin_(done_ids))
        .limit(50)
    )
    tasks = list(available.all())

    if not tasks and topic.bank_ege_topic_id:
        await fetch_tasks_for_subtopic(
            bank_ege_topic_id=topic.bank_ege_topic_id,
            exam_task_number=topic.exam_task_number or 1,
            topic_id=topic_id,
            needed=15,
        )
        available = await db.scalars(
            select(Task)
            .where(Task.topic_id == topic_id, Task.id.notin_(done_ids))
            .limit(50)
        )
        tasks = list(available.all())

    # Fall back to any task in topic if all are solved
    if not tasks:
        all_tasks = await db.scalars(select(Task).where(Task.topic_id == topic_id).limit(50))
        tasks = list(all_tasks.all())

    return random.choice(tasks) if tasks else None


async def get_today_session(user, db: AsyncSession, redis: Redis) -> TodaySession:
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


async def complete_session(session_id: str, user, db: AsyncSession) -> None:
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
    user,
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
