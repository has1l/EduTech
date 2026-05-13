from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser


router = APIRouter()


@router.get("/{dialogue_id}/stream")
async def stream_dialogue(dialogue_id: UUID, user: CurrentUser) -> dict:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="SSE stream — будет реализован в шаге AI service",
    )


@router.post("/{dialogue_id}/reply")
async def reply_dialogue(dialogue_id: UUID, user: CurrentUser) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")


@router.post("/{dialogue_id}/give-up")
async def give_up_dialogue(dialogue_id: UUID, user: CurrentUser) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")
