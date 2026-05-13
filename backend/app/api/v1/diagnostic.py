from fastapi import APIRouter, HTTPException, status

from app.core.deps import CurrentUser


router = APIRouter()


@router.post("/start")
async def start_diagnostic(user: CurrentUser) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")


@router.post("/answer")
async def answer_diagnostic(user: CurrentUser) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")


@router.get("/result")
async def diagnostic_result(user: CurrentUser) -> dict:
    raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="TODO")
