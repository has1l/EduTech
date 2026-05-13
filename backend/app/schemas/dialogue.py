from pydantic import BaseModel


class ReplyIn(BaseModel):
    text: str


class GiveUpResult(BaseModel):
    correct_answer: str
    explanation: str | None = None
