import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamped, UUIDPrimaryKey


class FSRSCard(Base, UUIDPrimaryKey, Timestamped):
    __tablename__ = "fsrs_cards"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    state: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    due: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    stability: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    difficulty: Mapped[float] = mapped_column(Float, default=5.0, nullable=False)
    last_review: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
