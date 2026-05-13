from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser


router = APIRouter()


@router.get("/map")
async def get_knowledge_map(user: CurrentUser) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")


@router.get("/score-prediction")
async def get_score_prediction(user: CurrentUser) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")


@router.get("/timeline")
async def get_progress_timeline(user: CurrentUser) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")
