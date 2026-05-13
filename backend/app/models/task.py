import uuid
from typing import Any

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamped, UUIDPrimaryKey


class Task(Base, UUIDPrimaryKey, Timestamped):
    __tablename__ = "tasks"

    topic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("topics.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    question_image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    options: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    correct_answer: Mapped[str] = mapped_column(String(255), nullable=False)
    solution_steps: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB, nullable=True)
    typical_errors: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    theory_section_ids: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    difficulty: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
