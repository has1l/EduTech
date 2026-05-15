"""add diagnostic_completed_at to users

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("diagnostic_completed_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "diagnostic_completed_at")
