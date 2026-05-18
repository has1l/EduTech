from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, DateTime, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamped, UUIDPrimaryKey


class User(Base, UUIDPrimaryKey, Timestamped):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    yandex_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)

    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    grade: Mapped[int | None] = mapped_column(Integer, nullable=True)
    current_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    exam_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    oge_current_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    oge_diagnostic_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    study_plan: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    plan_generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    diagnostic_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
