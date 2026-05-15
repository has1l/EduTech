import json
import logging
from datetime import date, datetime, timezone

from fastapi import APIRouter, HTTPException, status
from openai import AsyncOpenAI
from pydantic import BaseModel
from sqlalchemy import select

from app.config import settings
from app.core.deps import CurrentUser, DbSession
from app.models.progress import UserTopicProgress
from app.models.topic import Topic
from app.services.bank_ege_client import TASK_SECTIONS

router = APIRouter()
log = logging.getLogger(__name__)


class PlanGroup(BaseModel):
    task_number: int
    title: str
    priority: int
    why: str
    status: str  # weak | medium | strong
    mastery_pct: int


class StudyPlan(BaseModel):
    summary: str
    groups: list[PlanGroup]
    generated_at: str


class PlanOut(BaseModel):
    plan: StudyPlan | None
    needs_generation: bool


@router.get("", response_model=PlanOut)
async def get_plan(user: CurrentUser, db: DbSession) -> PlanOut:
    from app.models.user import User
    db_user = await db.get(User, user.id)
    if db_user is None or db_user.study_plan is None:
        return PlanOut(plan=None, needs_generation=True)
    return PlanOut(plan=StudyPlan(**db_user.study_plan), needs_generation=False)


@router.post("/generate", response_model=PlanOut)
async def generate_plan(user: CurrentUser, db: DbSession) -> PlanOut:
    from app.models.user import User

    db_user = await db.get(User, user.id)
    if db_user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    progress_rows = (
        await db.execute(
            select(UserTopicProgress, Topic)
            .join(Topic, Topic.id == UserTopicProgress.topic_id)
            .where(UserTopicProgress.user_id == user.id)
            .where(Topic.exam_task_number.isnot(None))
        )
    ).all()

    # Aggregate per task_number
    task_stats: dict[int, dict] = {}
    for row in progress_rows:
        prog, topic = row
        tn = topic.exam_task_number
        if tn not in task_stats:
            task_stats[tn] = {"correct": 0, "attempts": 0, "title": TASK_SECTIONS.get(tn, {}).get("title", f"Задание {tn}")}
        task_stats[tn]["correct"] += prog.correct_count
        task_stats[tn]["attempts"] += prog.attempts_count

    # Fill in sections with no attempts
    for tn, meta in TASK_SECTIONS.items():
        if tn not in task_stats:
            task_stats[tn] = {"correct": 0, "attempts": 0, "title": meta["title"]}

    days_left: int | None = None
    if db_user.exam_date:
        days_left = max(0, (db_user.exam_date - date.today()).days)

    task_lines = []
    for tn in sorted(task_stats.keys()):
        s = task_stats[tn]
        pct = round(s["correct"] / s["attempts"] * 100) if s["attempts"] > 0 else 0
        done = s["correct"]
        total = s["attempts"]
        task_lines.append(f"- Задание {tn} «{s['title']}»: {done}/{total} правильно ({pct}%)")

    target = db_user.target_score or 75
    days_str = f"{days_left} дней до экзамена" if days_left is not None else "дата экзамена не указана"

    prompt = f"""Ты опытный репетитор-методист по математике с 10-летним опытом подготовки к ЕГЭ.

Ученик хочет сдать ЕГЭ по профильной математике на {target} баллов. {days_str}.

Результаты по заданиям (правильных/всего ответов):
{chr(10).join(task_lines)}

Составь персональный план подготовки. Верни JSON (только JSON, без markdown):
{{
  "summary": "2-3 предложения: общая картина и главный совет",
  "groups": [
    {{
      "task_number": <число 1-12>,
      "title": "<название задания>",
      "priority": <1=первым делать, 2=вторым, ...>,
      "why": "<1-2 предложения: почему именно сейчас и что именно сделать>",
      "status": "<weak|medium|strong>"
    }}
  ]
}}

Правила:
- Расставь ВСЕ 12 заданий по priority от 1 до 12
- status: weak = меньше 40% правильных, medium = 40-75%, strong = больше 75% (или не пробовал)
- Для заданий с 0 попытками — определи статус исходя из сложности (трудные = weak по умолчанию)
- why: конкретно, мотивирующе, на «ты»
- summary: честно, поддерживающе
"""

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    try:
        resp = await client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content or "{}"
        data = json.loads(raw)
    except Exception as e:
        log.error("GPT plan generation failed: %s", e)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Не удалось сгенерировать план")

    # Enrich groups with mastery_pct
    groups_out = []
    for g in sorted(data.get("groups", []), key=lambda x: x["priority"]):
        tn = g["task_number"]
        s = task_stats.get(tn, {"correct": 0, "attempts": 0})
        mastery_pct = round(s["correct"] / s["attempts"] * 100) if s["attempts"] > 0 else 0
        groups_out.append(
            PlanGroup(
                task_number=tn,
                title=g.get("title", TASK_SECTIONS.get(tn, {}).get("title", f"Задание {tn}")),
                priority=g["priority"],
                why=g.get("why", ""),
                status=g.get("status", "medium"),
                mastery_pct=mastery_pct,
            )
        )

    plan = StudyPlan(
        summary=data.get("summary", ""),
        groups=groups_out,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )

    db_user.study_plan = plan.model_dump()
    db_user.plan_generated_at = datetime.now(timezone.utc)
    await db.commit()

    return PlanOut(plan=plan, needs_generation=False)
