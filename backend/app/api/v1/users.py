from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.deps import CurrentUser, DbSession
from app.schemas.auth import UserPublic


router = APIRouter()


class UpdateProfileRequest(BaseModel):
    name: str | None = None
    grade: int | None = Field(default=None, ge=8, le=11)
    target_score: int | None = Field(default=None, ge=0, le=100)
    exam_date: date | None = None


@router.get("/me", response_model=UserPublic)
async def get_me(user: CurrentUser) -> UserPublic:
    return UserPublic.model_validate(user)


@router.patch("/me", response_model=UserPublic)
async def update_me(body: UpdateProfileRequest, user: CurrentUser, db: DbSession) -> UserPublic:
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(user, key, value)
    await db.commit()
    await db.refresh(user)
    return UserPublic.model_validate(user)
