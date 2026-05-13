"""add task source_id

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-13
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("source_id", sa.String(64), nullable=True))
    op.create_index("ix_tasks_source_id", "tasks", ["source_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_source_id", table_name="tasks")
    op.drop_column("tasks", "source_id")
