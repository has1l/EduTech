from arq.connections import RedisSettings

from app.config import settings


async def ping(ctx: dict) -> str:
    return "pong"


def _redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(settings.redis_url)


class WorkerSettings:
    redis_settings = _redis_settings()
    functions: list = [ping]
    cron_jobs: list = []
    max_jobs = 10
