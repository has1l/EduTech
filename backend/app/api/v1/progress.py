import json
import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, status
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy import Date, Integer, cast, func, select

from app.config import settings
from app.core.deps import CurrentUser, DbSession, RedisClient
from app.models.attempt import Attempt
from app.models.streak import Streak
from app.models.task import Task
from app.models.topic import Topic
from app.services.bank_ege_client import OGE_TASK_SECTIONS, TASK_SECTIONS

router = APIRouter()
log = logging.getLogger(__name__)

USE_GPT_PREDICTION = True  # set False to use formula instead

# EGE Profile Part 1: primary points (0–12) → test score (max 70)
_EGE_P1: dict[int, int] = {
    0: 0, 1: 6, 2: 11, 3: 17, 4: 22, 5: 27,
    6: 34, 7: 39, 8: 46, 9: 52, 10: 58, 11: 64, 12: 70,
}

# OGE: total primary (0–31) → grade 2/3/4/5
def _oge_grade(primary: float) -> int:
    p = round(primary)
    if p >= 22: return 5
    if p >= 15: return 4
    if p >= 8:  return 3
    return 2


class ScorePrediction(BaseModel):
    target: int
    by_plan: int
    if_nothing: int
    explanation: str
    max_possible: int   # 70 for EGE Part 1, 5 for OGE
    is_oge: bool


# ─── formula (disabled, kept for future use) ─────────────────────────────────

def _formula_predict_ege(mastery: dict[int, float], days_left: int | None) -> tuple[int, int]:
    primary_now = sum(mastery.get(i, 0.0) for i in range(1, 13))
    days = days_left or 30
    by_plan = _EGE_P1.get(round(min(12.0, primary_now * (1 + 0.15 * days / 30))), 0)
    if_nothing = _EGE_P1.get(round(max(0.0, primary_now * (1 - 0.05 * days / 30))), 0)
    return by_plan, if_nothing


def _formula_predict_oge(mastery: dict[int, float], days_left: int | None) -> tuple[int, int]:
    primary_now = sum(mastery.get(i, 0.0) for i in range(1, 13))
    days = days_left or 30
    return _oge_grade(min(19.0, primary_now * (1 + 0.15 * days / 30))), _oge_grade(max(0.0, primary_now * 0.9))


# ─── GPT prediction ───────────────────────────────────────────────────────────

async def _gpt_predict(
    is_oge: bool,
    mastery: dict[int, float],
    stats: dict[int, dict],
    target: int,
    days_left: int | None,
    current_streak: int,
    sessions_last_7: int,
) -> tuple[int, int, str]:
    lines: list[str] = []
    task_range = range(6, 20) if is_oge else range(1, 13)
    sections_meta = OGE_TASK_SECTIONS if is_oge else TASK_SECTIONS
    for tn in task_range:
        title = sections_meta.get(tn, {}).get("title", f"Задание {tn}")
        m = mastery.get(tn, 0.0)
        s = stats.get(tn, {"correct": 0, "attempts": 0})
        lines.append(
            f"- Задание {tn} «{title}»: {round(m * 100)}% освоен "
            f"({s['correct']}/{s['attempts']} правильных)"
        )

    days_str = f"{days_left} дней" if days_left is not None else "неизвестно"
    pace_str = f"серия {current_streak} дней подряд, занимался {sessions_last_7} из последних 7 дней"

    if is_oge:
        prompt = f"""Ты эксперт по ОГЭ по математике и опытный репетитор.

Шкала ОГЭ: оценка 3 = 8-14 первичных, 4 = 15-21, 5 = 22-31 (из 31 возможного).
Ученик занимается заданиями 6-19 (14 из 19 заданий Части 1) в нашей системе.

Прогресс ученика:
{chr(10).join(lines)}

Цель: оценка {target} | Дней до экзамена: {days_str}
Темп занятий: {pace_str}

Рассчитай прогноз итоговой оценки (3/4/5), учитывая:
- задания 1-5 не охвачены системой (они дадут дополнительные баллы)
- реальный темп занятий ученика

Верни ТОЛЬКО JSON:
{{"by_plan": <3-5>, "if_nothing": <3-5>, "explanation": "<2 предложения: конкретно что тянет вниз и что даст быстрый рост, на 'ты'>"}}"""
    else:
        prompt = f"""Ты эксперт по ЕГЭ по профильной математике и опытный репетитор.

Часть 1 (задания 1-12): максимум 12 первичных = 70 тестовых баллов.
Шкала: 1→6, 2→11, 3→17, 4→22, 5→27, 6→34, 7→39, 8→46, 9→52, 10→58, 11→64, 12→70.
Ученик занимается только Частью 1 в нашей системе.

Прогресс ученика:
{chr(10).join(lines)}

Цель: {target} баллов | Дней до экзамена: {days_str}
Темп занятий: {pace_str}

Рассчитай прогноз тестовых баллов за Часть 1 (максимум 70).
«По плану» — если сохранит текущий темп занятий.
«Без занятий» — текущий уровень с учётом забывания.

Верни ТОЛЬКО JSON:
{{"by_plan": <0-70>, "if_nothing": <0-70>, "explanation": "<2 предложения: конкретно что тянет вниз и что даст быстрый рост, на 'ты'>"}}

Правила: by_plan ≥ if_nothing, оба ≤ 70, учитывай реальный темп ({sessions_last_7} дней/неделю), рост реалистичен за {days_str}."""

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    resp = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        response_format={"type": "json_object"},
    )
    data = json.loads(resp.choices[0].message.content or "{}")
    return data.get("by_plan", 0), data.get("if_nothing", 0), data.get("explanation", "")


# ─── endpoint ─────────────────────────────────────────────────────────────────

@router.get("/score-prediction", response_model=ScorePrediction)
async def get_score_prediction(user: CurrentUser, db: DbSession, redis: RedisClient) -> ScorePrediction:
    cache_key = f"score_pred:{user.id}"
    cached = await redis.get(cache_key)
    if cached:
        return ScorePrediction(**json.loads(cached))

    from app.models.user import User
    db_user = await db.get(User, user.id)
    if db_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    is_oge = (db_user.grade or 11) <= 9
    target = db_user.target_score or (4 if is_oge else 75)
    days_left: int | None = None
    if db_user.exam_date:
        days_left = max(0, (db_user.exam_date - date.today()).days)

    # Count correct answers per topic from attempts (same source as the path/knowledge map)
    rows = (
        await db.execute(
            select(
                Topic.exam_task_number,
                func.count(Attempt.id).label("total"),
                func.sum(Attempt.is_correct.cast(Integer)).label("correct"),
            )
            .join(Task, Task.topic_id == Topic.id)
            .join(Attempt, Attempt.task_id == Task.id)
            .where(Attempt.user_id == user.id)
            .where(Topic.exam_task_number.isnot(None))
            .group_by(Topic.exam_task_number)
        )
    ).all()

    task_sums: dict[int, list[float]] = {}
    task_stats: dict[int, dict] = {}
    for tn, total, correct in rows:
        correct_int = int(correct or 0)
        total_int = int(total or 0)
        task_sums.setdefault(tn, []).append(min(correct_int / 5, 1.0))
        task_stats[tn] = {"correct": correct_int, "attempts": total_int}

    mastery = {tn: sum(v) / len(v) for tn, v in task_sums.items()}

    streak_row = await db.get(Streak, user.id)
    current_streak = streak_row.current_streak if streak_row else 0

    seven_days_ago = date.today() - timedelta(days=7)
    sessions_result = await db.execute(
        select(func.count(func.distinct(cast(Attempt.created_at, Date))))
        .where(Attempt.user_id == user.id)
        .where(Attempt.created_at >= seven_days_ago)
    )
    sessions_last_7 = sessions_result.scalar() or 0

    try:
        if USE_GPT_PREDICTION:
            by_plan, if_nothing, explanation = await _gpt_predict(
                is_oge, mastery, task_stats, target, days_left, current_streak, sessions_last_7
            )
        elif is_oge:
            by_plan, if_nothing = _formula_predict_oge(mastery, days_left)
            explanation = ""
        else:
            by_plan, if_nothing = _formula_predict_ege(mastery, days_left)
            explanation = ""
    except Exception as e:
        log.error("Score prediction failed: %s", e)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Не удалось рассчитать прогноз")

    result = ScorePrediction(
        target=target,
        by_plan=by_plan,
        if_nothing=if_nothing,
        explanation=explanation,
        max_possible=5 if is_oge else 70,
        is_oge=is_oge,
    )
    await redis.set(cache_key, result.model_dump_json(), ex=86400)
    return result


@router.get("/map")
async def get_knowledge_map(user: CurrentUser) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")


@router.get("/timeline")
async def get_progress_timeline(user: CurrentUser) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")
