import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert

from app.core.deps import CurrentUser, DbSession
from app.models.booster import BoosterItem
from app.models.task import Task
from app.models.topic import Topic

router = APIRouter()

_OGE_SUBJECT_CODE = "math_oge"
_EGE_SUBJECT_CODE = "math_ege"


async def _user_subject_id(user: CurrentUser, db: DbSession) -> uuid.UUID:
    from app.models.subject import Subject
    is_oge = (getattr(user, "grade", None) or 11) <= 9
    code = _OGE_SUBJECT_CODE if is_oge else _EGE_SUBJECT_CODE
    subj = await db.scalar(select(Subject).where(Subject.code == code))
    if subj is None:
        raise HTTPException(status_code=500, detail="Subject not found")
    return subj.id


class BoosterItemOut(BaseModel):
    task_id: str
    topic_id: str | None
    reason: str
    question_preview: str
    added_at: str

    model_config = {"from_attributes": True}


class AddBoosterIn(BaseModel):
    task_id: str
    topic_id: str | None = None
    reason: str = "skipped"
    question_preview: str = ""


class UpdateReasonIn(BaseModel):
    reason: str


@router.get("", response_model=list[BoosterItemOut])
async def get_booster(user: CurrentUser, db: DbSession) -> list[BoosterItemOut]:
    subj_id = await _user_subject_id(user, db)
    rows = (await db.execute(
        select(BoosterItem)
        .join(Task, Task.id == BoosterItem.task_id)
        .join(Topic, Topic.id == Task.topic_id)
        .where(BoosterItem.user_id == user.id)
        .where(Topic.subject_id == subj_id)
        .order_by(BoosterItem.added_at.desc())
    )).scalars().all()
    return [
        BoosterItemOut(
            task_id=str(r.task_id),
            topic_id=str(r.topic_id) if r.topic_id else None,
            reason=r.reason,
            question_preview=r.question_preview,
            added_at=r.added_at.isoformat(),
        )
        for r in rows
    ]


@router.get("/count")
async def get_booster_count(user: CurrentUser, db: DbSession) -> dict:
    subj_id = await _user_subject_id(user, db)
    rows = (await db.execute(
        select(BoosterItem)
        .join(Task, Task.id == BoosterItem.task_id)
        .join(Topic, Topic.id == Task.topic_id)
        .where(BoosterItem.user_id == user.id)
        .where(Topic.subject_id == subj_id)
    )).scalars().all()
    return {"count": len(rows)}


@router.post("", response_model=BoosterItemOut)
async def add_to_booster(body: AddBoosterIn, user: CurrentUser, db: DbSession) -> BoosterItemOut:
    task_uuid = uuid.UUID(body.task_id)
    topic_uuid = uuid.UUID(body.topic_id) if body.topic_id else None

    stmt = (
        insert(BoosterItem)
        .values(
            user_id=user.id,
            task_id=task_uuid,
            topic_id=topic_uuid,
            reason=body.reason,
            question_preview=body.question_preview,
            added_at=datetime.now(timezone.utc),
        )
        .on_conflict_do_update(
            constraint="uq_booster_user_task",
            set_={"reason": body.reason, "question_preview": body.question_preview},
        )
        .returning(BoosterItem)
    )
    result = (await db.execute(stmt)).scalar_one()
    await db.commit()
    return BoosterItemOut(
        task_id=str(result.task_id),
        topic_id=str(result.topic_id) if result.topic_id else None,
        reason=result.reason,
        question_preview=result.question_preview,
        added_at=result.added_at.isoformat(),
    )


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_booster(task_id: str, user: CurrentUser, db: DbSession) -> None:
    await db.execute(
        delete(BoosterItem)
        .where(BoosterItem.user_id == user.id)
        .where(BoosterItem.task_id == uuid.UUID(task_id))
    )
    await db.commit()


@router.patch("/{task_id}/reason", response_model=BoosterItemOut)
async def update_reason(task_id: str, body: UpdateReasonIn, user: CurrentUser, db: DbSession) -> BoosterItemOut:
    row = (await db.execute(
        select(BoosterItem)
        .where(BoosterItem.user_id == user.id)
        .where(BoosterItem.task_id == uuid.UUID(task_id))
    )).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    row.reason = body.reason
    await db.commit()
    return BoosterItemOut(
        task_id=str(row.task_id),
        topic_id=str(row.topic_id) if row.topic_id else None,
        reason=row.reason,
        question_preview=row.question_preview,
        added_at=row.added_at.isoformat(),
    )
