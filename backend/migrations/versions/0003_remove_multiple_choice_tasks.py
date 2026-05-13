"""remove seeded multiple_choice tasks

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-13
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("DELETE FROM tasks WHERE type = 'multiple_choice'")


def downgrade() -> None:
    pass
