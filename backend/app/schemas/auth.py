from datetime import date
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class YandexAuthRequest(BaseModel):
    code: str
    redirect_uri: str | None = None


class UserPublic(BaseModel):
    id: UUID
    email: str
    name: str | None
    grade: int | None
    current_score: int | None
    target_score: int | None
    exam_date: date | None

    model_config = {"from_attributes": True}


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "Bearer"


class AuthResponse(BaseModel):
    user: UserPublic
    tokens: TokenPair
    needs_onboarding: bool
