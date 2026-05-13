from uuid import UUID

from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import create_token, decode_token
from app.models.user import User
from app.schemas.auth import TokenPair


def _refresh_key(jti: str) -> str:
    return f"refresh:{jti}"


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
