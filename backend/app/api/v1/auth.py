from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.config import settings
from app.core.deps import DbSession, RedisClient
from app.core.security import hash_password, verify_password
from app.models.user import User
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenPair,
    UserPublic,
    YandexAuthRequest,
)
from app.services.auth_service import (
    exchange_yandex_code,
    fetch_yandex_user_info,
    find_or_create_yandex_user,
    is_user_onboarded,
    issue_token_pair,
    revoke_refresh_token,
    rotate_refresh_token,
)


router = APIRouter()


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: DbSession, redis: RedisClient) -> AuthResponse:
    existing = await db.scalar(select(User).where(User.email == body.email))
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        name=body.name,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    tokens = await issue_token_pair(user, redis)
    return AuthResponse(
        user=UserPublic.model_validate(user),
        tokens=tokens,
        needs_onboarding=True,
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: DbSession, redis: RedisClient) -> AuthResponse:
    user = await db.scalar(select(User).where(User.email == body.email))
    if user is None or user.password_hash is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    tokens = await issue_token_pair(user, redis)
    return AuthResponse(
        user=UserPublic.model_validate(user),
        tokens=tokens,
        needs_onboarding=not is_user_onboarded(user),
    )


@router.post("/refresh", response_model=TokenPair)
async def refresh(body: RefreshRequest, db: DbSession, redis: RedisClient) -> TokenPair:
    try:
        _, tokens = await rotate_refresh_token(body.refresh_token, db, redis)
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        ) from e
    return tokens


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(body: RefreshRequest, redis: RedisClient) -> None:
    await revoke_refresh_token(body.refresh_token, redis)


@router.post("/yandex", response_model=AuthResponse)
async def yandex_auth(body: YandexAuthRequest, db: DbSession, redis: RedisClient) -> AuthResponse:
    if body.redirect_uri and body.redirect_uri != settings.yandex_redirect_uri_web:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Yandex redirect URI",
        )

    try:
        yandex_access_token = await exchange_yandex_code(body.code)
        yandex_user = await fetch_yandex_user_info(yandex_access_token)
        user = await find_or_create_yandex_user(yandex_user, db)
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e
    except PermissionError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
        ) from e

    tokens = await issue_token_pair(user, redis)
    return AuthResponse(
        user=UserPublic.model_validate(user),
        tokens=tokens,
        needs_onboarding=not is_user_onboarded(user),
    )
