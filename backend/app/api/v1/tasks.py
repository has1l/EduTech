from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser


router = APIRouter()


@router.get("/{task_id}")
async def get_task(task_id: UUID, user: CurrentUser) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")


@router.post("/{task_id}/answer")
async def answer_task(task_id: UUID, user: CurrentUser) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")
