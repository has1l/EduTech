"""add oge_current_score and oge_diagnostic_completed_at to users

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-18
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("oge_current_score", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("oge_diagnostic_completed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "oge_diagnostic_completed_at")
    op.drop_column("users", "oge_current_score")
