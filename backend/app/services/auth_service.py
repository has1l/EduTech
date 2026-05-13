from typing import TypedDict
from uuid import UUID

import httpx
from redis.asyncio import Redis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import create_token, decode_token
from app.models.user import User
from app.schemas.auth import TokenPair


def _refresh_key(jti: str) -> str:
    return f"refresh:{jti}"


class YandexUserInfo(TypedDict):
    id: str
    email: str
    name: str | None


async def issue_token_pair(user: User, redis: Redis) -> TokenPair:
    access_token, _ = create_token(str(user.id), "access")
    refresh_token, refresh_jti = create_token(str(user.id), "refresh")

    await redis.setex(
        _refresh_key(refresh_jti),
        settings.refresh_token_ttl,
        str(user.id),
    )

    return TokenPair(access_token=access_token, refresh_token=refresh_token)


async def rotate_refresh_token(
    refresh_token: str,
    db: AsyncSession,
    redis: Redis,
) -> tuple[User, TokenPair]:
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except ValueError as e:
        raise PermissionError(str(e)) from e

    jti = payload["jti"]
    user_id_in_redis = await redis.get(_refresh_key(jti))
    if user_id_in_redis is None:
        raise PermissionError("Refresh token revoked or expired")

    await redis.delete(_refresh_key(jti))

    user_id = UUID(payload["sub"])
    user = await db.get(User, user_id)
    if user is None:
        raise PermissionError("User no longer exists")

    new_tokens = await issue_token_pair(user, redis)
    return user, new_tokens


async def revoke_refresh_token(refresh_token: str, redis: Redis) -> None:
    try:
        payload = decode_token(refresh_token, expected_type="refresh")
    except ValueError:
        return
    await redis.delete(_refresh_key(payload["jti"]))


def is_user_onboarded(user: User) -> bool:
    return user.grade is not None and user.target_score is not None


async def exchange_yandex_code(code: str) -> str:
    if not settings.yandex_client_id or not settings.yandex_client_secret:
        raise RuntimeError("Yandex OAuth is not configured")

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            "https://oauth.yandex.ru/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "client_id": settings.yandex_client_id,
                "client_secret": settings.yandex_client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

    if response.status_code != 200:
        raise PermissionError("Yandex authorization code is invalid or expired")

    payload = response.json()
    access_token = payload.get("access_token")
    if not isinstance(access_token, str) or not access_token:
        raise PermissionError("Yandex did not return an access token")
    return access_token


async def fetch_yandex_user_info(access_token: str) -> YandexUserInfo:
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(
            "https://login.yandex.ru/info",
            params={"format": "json"},
            headers={"Authorization": f"OAuth {access_token}"},
        )

    if response.status_code != 200:
        raise PermissionError("Could not fetch Yandex profile")

    payload = response.json()
    yandex_id = payload.get("id")
    email = payload.get("default_email")
    emails = payload.get("emails")
    if not email and isinstance(emails, list) and emails:
        email = emails[0]

    if not isinstance(yandex_id, str) or not yandex_id:
        raise PermissionError("Yandex profile does not contain user id")
    if not isinstance(email, str) or not email:
        raise PermissionError("Yandex profile does not contain email")

    name = payload.get("real_name") or payload.get("display_name") or payload.get("login")
    if not isinstance(name, str) or not name:
        name = None

    return {"id": yandex_id, "email": email, "name": name}


async def find_or_create_yandex_user(info: YandexUserInfo, db: AsyncSession) -> User:
    user = await db.scalar(select(User).where(User.yandex_id == info["id"]))
    if user is not None:
        if not user.name and info["name"]:
            user.name = info["name"]
        await db.commit()
        await db.refresh(user)
        return user

    user = await db.scalar(select(User).where(User.email == info["email"]))
    if user is not None:
        if user.yandex_id and user.yandex_id != info["id"]:
            raise PermissionError("Email is already linked to another Yandex account")
        user.yandex_id = info["id"]
        if not user.name and info["name"]:
            user.name = info["name"]
        await db.commit()
        await db.refresh(user)
        return user

    user = User(
        email=info["email"],
        yandex_id=info["id"],
        name=info["name"],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
