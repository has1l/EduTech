from datetime import date

from sqlalchemy import Date, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamped, UUIDPrimaryKey


class User(Base, UUIDPrimaryKey, Timestamped):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    yandex_id: Mapped[str | None] = mapped_column(String(64), unique=True, index=True, nullable=True)

    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    grade: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    exam_date: Mapped[date | None] = mapped_column(Date, nullable=True)
