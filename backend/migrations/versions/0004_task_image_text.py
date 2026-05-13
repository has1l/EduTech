"""task question_image_url varchar -> text

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-14
"""
import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("tasks", "question_image_url", type_=sa.Text())


def downgrade() -> None:
    pass
