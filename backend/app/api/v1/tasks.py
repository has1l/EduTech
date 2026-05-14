from uuid import UUID

import httpx
from fastapi import APIRouter, HTTPException, Query, status
from fastapi.responses import Response

from app.core.deps import CurrentUser, DbSession, RedisClient
from app.schemas.tasks import AnswerIn, AnswerResult, SubtopicSession, TaskOut
from app.services.task_service import get_random_tasks_for_topic, get_task, process_answer

router = APIRouter()

_ALLOWED_HOSTS = ("bank-ege.ru", "new-api.bank-ege.ru", "storage.yandexcloud.net")
_PROXY_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    "Referer": "https://bank-ege.ru/",
}


@router.get("/image-proxy")
async def image_proxy(
    url: str = Query(...),
    user: CurrentUser = None,
) -> Response:
    from urllib.parse import urlparse
    host = urlparse(url).hostname or ""
    if not any(host == h or host.endswith("." + h) for h in _ALLOWED_HOSTS):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Forbidden host")
    try:
        async with httpx.AsyncClient(headers=_PROXY_HEADERS, timeout=10, follow_redirects=True) as client:
            r = await client.get(url)
            r.raise_for_status()
        return Response(
            content=r.content,
            media_type=r.headers.get("content-type", "image/png"),
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to fetch image")


@router.get("/subtopic-session", response_model=SubtopicSession)
async def subtopic_session(
    topic_id: UUID = Query(...),
    count: int = Query(default=5, ge=1, le=20),
    user: CurrentUser = None,
    db: DbSession = None,
    redis: RedisClient = None,
) -> SubtopicSession:
    tasks = await get_random_tasks_for_topic(topic_id, user, db, count)
    if not tasks:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No tasks for this topic")
    return SubtopicSession(tasks=[TaskOut.model_validate(t) for t in tasks])


@router.get("/{task_id}", response_model=TaskOut)
async def get_task_endpoint(task_id: UUID, user: CurrentUser, db: DbSession) -> TaskOut:
    task = await get_task(task_id, db)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return TaskOut.model_validate(task)


@router.post("/{task_id}/answer", response_model=AnswerResult)
async def answer_task(
    task_id: UUID,
    body: AnswerIn,
    user: CurrentUser,
    db: DbSession,
) -> AnswerResult:
    task = await get_task(task_id, db)
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return await process_answer(task.id, user, body.answer, body.time_spent_sec, db)
