from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser


router = APIRouter()


@router.get("")
async def get_streak(user: CurrentUser) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")


@router.post("/freeze")
async def use_streak_freeze(user: CurrentUser) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")
