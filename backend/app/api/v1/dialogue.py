from uuid import UUID

from fastapi import APIRouter, HTTPException, status
from sse_starlette.sse import EventSourceResponse

from app.core.deps import CurrentUser, DbSession
from app.schemas.dialogue import GiveUpResult, ReplyIn
from app.services.ai_service import stream_socratic
from app.services.task_service import load_dialogue_context

router = APIRouter()


@router.get("/{dialogue_id}/stream")
async def stream_dialogue(
    dialogue_id: UUID,
    user: CurrentUser,
    db: DbSession,
) -> EventSourceResponse:
    ctx = await load_dialogue_context(dialogue_id, user, db)
    if ctx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialogue not found")

    dialogue, task, attempt, theory = ctx

    async def generator():
        full_text = ""
        async for event in stream_socratic(dialogue, task, attempt, theory):
            if event.get("event") == "done":
                full_text = event.pop("_full_text", "")
            yield event

        if full_text:
            dialogue.messages = list(dialogue.messages) + [
                {"role": "assistant", "content": full_text}
            ]
            dialogue.hint_level = min(dialogue.hint_level + 1, 3)
            await db.commit()

    return EventSourceResponse(generator())


@router.post("/{dialogue_id}/reply")
async def reply_dialogue(
    dialogue_id: UUID,
    body: ReplyIn,
    user: CurrentUser,
    db: DbSession,
) -> dict:
    ctx = await load_dialogue_context(dialogue_id, user, db)
    if ctx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialogue not found")

    dialogue = ctx[0]
    dialogue.messages = list(dialogue.messages) + [{"role": "user", "content": body.text}]
    await db.commit()
    return {"ok": True}


@router.post("/{dialogue_id}/give-up", response_model=GiveUpResult)
async def give_up_dialogue(
    dialogue_id: UUID,
    user: CurrentUser,
    db: DbSession,
) -> GiveUpResult:
    ctx = await load_dialogue_context(dialogue_id, user, db)
    if ctx is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dialogue not found")

    dialogue, task, attempt, _ = ctx
    dialogue.resolved = True
    await db.commit()

    explanation = None
    if task.solution_steps:
        steps = task.solution_steps
        if isinstance(steps, dict):
            parts = steps.get("steps") or []
            explanation = "\n".join(str(p) for p in parts if p) or None
        elif isinstance(steps, list):
            explanation = "\n".join(
                s.get("text", "") if isinstance(s, dict) else str(s) for s in steps
            ) or None

    return GiveUpResult(correct_answer=task.correct_answer, explanation=explanation)
