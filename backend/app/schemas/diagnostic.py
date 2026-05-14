from uuid import UUID

from pydantic import BaseModel

from app.schemas.tasks import TaskOut


class DiagnosticStartOut(BaseModel):
    session_id: str
    tasks: list[TaskOut]


class DiagnosticAnswerIn(BaseModel):
    task_id: UUID
    answer: str


class DiagnosticSubmitIn(BaseModel):
    session_id: str
    answers: list[DiagnosticAnswerIn]


class SectionResult(BaseModel):
    task_number: int
    title: str
    difficulty: int
    is_correct: bool
    correct_answer: str
    topic_title: str


class DiagnosticResultOut(BaseModel):
    total: int
    correct: int
    sections: list[SectionResult]
