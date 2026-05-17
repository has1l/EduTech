import json
import logging
import random
from datetime import date
from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy import Integer, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.attempt import Attempt
from app.models.dialogue import AIDialogue
from app.models.streak import Streak
from app.models.task import Task
from app.models.theory import TheorySection
from app.models.topic import Topic
from app.schemas.tasks import AnswerResult, PathNodeOut, SessionPathOut, TaskOut, TaskSection, TodaySession
from app.services.bank_ege_client import (
    OGE_TASK_SECTIONS,
    TASK_SECTIONS,
    _EGE_SUBJECT_CODE,
    _OGE_SUBJECT_CODE,
    fetch_and_store_tasks,
    fetch_tasks_for_oge_subtopic,
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
    """Returns subtopic path grouped into sections with per-section unlocking. Supports both EGE and OGE."""
    from collections import defaultdict

    from app.models.subject import Subject

    is_oge = (getattr(user, "grade", None) or 11) <= 9
    subject_code = _OGE_SUBJECT_CODE if is_oge else _EGE_SUBJECT_CODE
    sections_meta = OGE_TASK_SECTIONS if is_oge else TASK_SECTIONS

    subj = await db.scalar(select(Subject).where(Subject.code == subject_code))
    if subj is None:
        return SessionPathOut(sections=[])

    topics_result = await db.scalars(
        select(Topic).where(
            Topic.subject_id == subj.id,
            Topic.exam_task_number.isnot(None),
        )
    )

    def _topic_sort_key(t: Topic) -> tuple[int, int]:
        parts = t.code.split(".")
        return (int(parts[0]), int(parts[1])) if len(parts) == 2 else (0, 0)

    all_topics = sorted(topics_result.all(), key=_topic_sort_key)
    if not all_topics:
        return SessionPathOut(sections=[])

    topic_ids = [t.id for t in all_topics]

    rows = await db.execute(
        select(Task.topic_id, func.count(Attempt.id), func.sum(Attempt.is_correct.cast(Integer)))
        .join(Attempt, Attempt.task_id == Task.id)
        .where(Attempt.user_id == user.id, Task.topic_id.in_(topic_ids))
        .group_by(Task.topic_id)
    )
    stats: dict[UUID, tuple[int, int]] = {}
    for topic_id, total, correct in rows:
        stats[topic_id] = (int(total), int(correct or 0))

    by_task: dict[int, list[Topic]] = defaultdict(list)
    for t in all_topics:
        if t.exam_task_number is not None:
            by_task[t.exam_task_number].append(t)

    sections: list[TaskSection] = []
    for task_num in sorted(by_task.keys()):
        group = by_task[task_num]
        meta = sections_meta.get(task_num, {"title": f"Задание {task_num}", "difficulty": 2})
        found_current = False
        nodes: list[PathNodeOut] = []

        for topic in group:
            attempts_count, correct_count = stats.get(topic.id, (0, 0))
            is_completed = correct_count >= 5

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
                task_number=task_num,
                state=state,
                attempts_count=attempts_count,
                correct_count=correct_count,
            ))

        sections.append(TaskSection(
            task_number=task_num,
            title=meta["title"],
            difficulty=meta["difficulty"],
            nodes=nodes,
        ))

    return SessionPathOut(sections=sections)


async def get_random_tasks_for_topic(
    topic_id: UUID,
    user,
    db: AsyncSession,
    count: int = 5,
) -> list[Task]:
    from app.models.subject import Subject

    topic = await db.get(Topic, topic_id)
    if topic is None:
        return []

    subj = await db.get(Subject, topic.subject_id) if topic.subject_id else None
    is_oge = subj.code == _OGE_SUBJECT_CODE if subj else False

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
    pool = list(available.all())

    # Fetch from bank-ege if not enough tasks
    if len(pool) < count and topic.bank_ege_topic_id:
        if is_oge:
            await fetch_tasks_for_oge_subtopic(
                bank_ege_topic_id=topic.bank_ege_topic_id,
                topic_id=topic_id,
                needed=max(15, count * 3),
            )
        else:
            await fetch_tasks_for_subtopic(
                bank_ege_topic_id=topic.bank_ege_topic_id,
                exam_task_number=topic.exam_task_number or 1,
                topic_id=topic_id,
                needed=max(15, count * 3),
            )
        available = await db.scalars(
            select(Task)
            .where(Task.topic_id == topic_id, Task.id.notin_(done_ids))
            .limit(50)
        )
        pool = list(available.all())

    # Fall back to any task in topic if all are solved
    if len(pool) < count:
        all_tasks = await db.scalars(select(Task).where(Task.topic_id == topic_id).limit(50))
        pool = list(all_tasks.all())

    if not pool:
        return []

    random.shuffle(pool)
    return pool[:count]


async def get_today_session(user, db: AsyncSession, redis: Redis) -> TodaySession:
    from app.models.subject import Subject

    cache_key = _today_key(user.id)
    cached = await redis.get(cache_key)

    done_today = await db.scalars(
        select(Attempt.task_id).where(
            Attempt.user_id == user.id,
            func.date(Attempt.created_at) == date.today(),
        )
    )
    done_ids = set(done_today.all())

    is_oge = (getattr(user, "grade", None) or 11) <= 9
    subject_code = _OGE_SUBJECT_CODE if is_oge else _EGE_SUBJECT_CODE

    subj = await db.scalar(select(Subject).where(Subject.code == subject_code))
    subj_id = subj.id if subj else None

    if cached:
        task_ids = json.loads(cached)
        tasks_q = await db.execute(select(Task).where(Task.id.in_(task_ids)))
        tasks = list(tasks_q.scalars().all())
        tasks.sort(key=lambda t: task_ids.index(str(t.id)))
        if not tasks:
            await redis.delete(cache_key)
            cached = None

    if not cached:
        if subj_id:
            available = await db.scalars(
                select(Task)
                .join(Topic, Topic.id == Task.topic_id)
                .where(Task.id.notin_(done_ids), Topic.subject_id == subj_id)
                .limit(5)
            )
        else:
            available = await db.scalars(
                select(Task).where(Task.id.notin_(done_ids)).limit(5)
            )
        tasks = list(available.all())

        if len(tasks) < 5:
            if is_oge:
                await _fetch_oge_tasks_if_needed(db)
            else:
                await fetch_and_store_tasks(redis, needed=15)
            if subj_id:
                available = await db.scalars(
                    select(Task)
                    .join(Topic, Topic.id == Task.topic_id)
                    .where(Task.id.notin_(done_ids), Topic.subject_id == subj_id)
                    .limit(5)
                )
            else:
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


async def _fetch_oge_tasks_if_needed(db: AsyncSession) -> None:
    """Fetch tasks for the first OGE subtopic that's short on tasks."""
    from app.models.subject import Subject

    subj = await db.scalar(select(Subject).where(Subject.code == _OGE_SUBJECT_CODE))
    if subj is None:
        return

    topic = await db.scalar(
        select(Topic)
        .where(Topic.subject_id == subj.id, Topic.bank_ege_topic_id.isnot(None))
        .limit(1)
    )
    if topic and topic.bank_ege_topic_id:
        await fetch_tasks_for_oge_subtopic(
            bank_ege_topic_id=topic.bank_ege_topic_id,
            topic_id=topic.id,
            needed=15,
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

    # Burn expired streak before applying today's activity
    if streak.last_session_date and streak.current_streak > 0:
        days_since = (today - streak.last_session_date).days
        if days_since > 1 and not (days_since == 2 and streak.freezes_available > 0):
            streak.current_streak = 0

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
