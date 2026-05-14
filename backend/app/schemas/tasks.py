from uuid import UUID

from pydantic import BaseModel


class TaskOption(BaseModel):
    id: str
    text: str


class TaskOut(BaseModel):
    id: UUID
    topic_id: UUID
    type: str
    question_text: str
    question_image_url: str | None = None
    options: list[TaskOption] | None = None
    difficulty: int

    model_config = {"from_attributes": True}


class AnswerIn(BaseModel):
    answer: str
    time_spent_sec: int | None = None


class AnswerResult(BaseModel):
    correct: bool
    dialogue_id: UUID | None = None


class TodaySession(BaseModel):
    session_id: str
    tasks: list[TaskOut]


class SubtopicSession(BaseModel):
    tasks: list[TaskOut]


class PathNodeOut(BaseModel):
    topic_id: UUID
    title: str
    subtopic_number: str
    task_number: int
    state: str  # completed | current | locked
    attempts_count: int
    correct_count: int


class SessionPathOut(BaseModel):
    nodes: list[PathNodeOut]
