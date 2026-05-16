import json
from collections.abc import AsyncGenerator
from typing import Any

from openai import AsyncOpenAI

from app.config import settings
from app.models.attempt import Attempt
from app.models.dialogue import AIDialogue
from app.models.task import Task
from app.models.theory import TheorySection


def _hint_instruction(hint_level: int) -> str:
    if hint_level == 1:
        return "Задай ОДИН конкретный вопрос про шаг, где скорее всего ошибка."
    if hint_level == 2:
        return "Дай конкретную подсказку, направляющую к правильному решению (ответ не называй)."
    return (
        "Объясни полностью: где была ошибка и как решить правильно, шаг за шагом. "
        "Назови правильный ответ. В конце спроси: «Всё понятно? Есть вопросы?»"
    )


def _build_system_prompt(task: Task, attempt: Attempt, hint_level: int = 1) -> str:
    options_text = ""
    if task.options:
        parts = [f"{o['id']}) {o['text']}" for o in task.options]
        options_text = "\nВарианты: " + ", ".join(parts)

    error_hypothesis = ""
    if task.typical_errors and attempt.user_answer in task.typical_errors:
        error_hypothesis = (
            "\nВероятная ошибка ученика: "
            + task.typical_errors[attempt.user_answer].get("hypothesis", "")
        )

    no_spoiler = "" if hint_level >= 3 else "- НЕ называй правильный ответ напрямую\n"

    return (
        "Ты педагог-тьютор по математике. Ученик решал задачу и дал неверный ответ. "
        "Помоги ему самостоятельно найти ошибку через сократический диалог.\n\n"
        f"Задача: {task.question_text}{options_text}\n"
        f"Правильный ответ: {task.correct_answer}\n"
        f"Ответ ученика: {attempt.user_answer}"
        f"{error_hypothesis}\n\n"
        "Правила:\n"
        "- Обращайся на «ты», тон дружелюбный и поддерживающий\n"
        "- Отвечай коротко — 1-3 предложения\n"
        f"{no_spoiler}"
    )


async def stream_socratic(
    dialogue: AIDialogue,
    task: Task,
    attempt: Attempt,
    theory_section: TheorySection | None,
) -> AsyncGenerator[dict[str, Any], None]:
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    system = _build_system_prompt(task, attempt, dialogue.hint_level)
    system += _hint_instruction(dialogue.hint_level)

    messages: list[dict[str, Any]] = [{"role": "system", "content": system}]

    # Send image only on first turn — base64 URIs are 30-80k tokens each
    if task.question_image_url and not dialogue.messages:
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": "Изображение к задаче:"},
                {"type": "image_url", "image_url": {"url": task.question_image_url}},
            ],
        })
        messages.append({"role": "assistant", "content": "Вижу изображение к задаче."})

    for msg in dialogue.messages:
        messages.append({"role": msg["role"], "content": msg["content"]})

    full_text = ""

    try:
        stream = await client.chat.completions.create(
            model=settings.openai_model,
            messages=messages,
            stream=True,
            max_tokens=500,
            temperature=0.7,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                full_text += delta
                yield {"event": "token", "data": json.dumps(delta, ensure_ascii=False)}

    except Exception as e:
        yield {"event": "error", "data": json.dumps({"message": str(e)}, ensure_ascii=False)}
        return

    theory_ref = None
    if theory_section:
        theory_ref = {"title": theory_section.title, "section_id": str(theory_section.id)}

    meta = {"theory_ref": theory_ref, "hint_level": dialogue.hint_level}
    yield {"event": "meta", "data": json.dumps(meta, ensure_ascii=False)}
    yield {"event": "done", "data": "", "_full_text": full_text}
