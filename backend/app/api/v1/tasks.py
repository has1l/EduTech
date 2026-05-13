from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser, DbSession
from app.schemas.tasks import AnswerIn, AnswerResult, TaskOut
from app.services.task_service import get_task, process_answer

router = APIRouter()


@router.get("/{task_id}", response_model=TaskOut)
async def get_task_endpoint(task_id: UUID, user: CurrentUser, db: DbSession) -> TaskOut:
    task = await get_task(task_id, db)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return TaskOut.model_validate(task)


@router.post("/{task_id}/answer", response_model=AnswerResult)
async def answer_task(
    task_id: UUID,
    body: AnswerIn,
    user: CurrentUser,
    db: DbSession,
) -> AnswerResult:
    task = await get_task(task_id, db)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return await process_answer(task.id, user, body.answer, body.time_spent_sec, db)
