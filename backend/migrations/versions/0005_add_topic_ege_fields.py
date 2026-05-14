"""add exam_task_number and bank_ege_topic_id to topics

Revision ID: 0005
Revises: 0004
Create Date: 2026-05-14
"""
import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("topics", sa.Column("exam_task_number", sa.Integer(), nullable=True))
    op.add_column("topics", sa.Column("bank_ege_topic_id", sa.Integer(), nullable=True))
    op.create_index("ix_topics_bank_ege_topic_id", "topics", ["bank_ege_topic_id"])


def downgrade() -> None:
    op.drop_index("ix_topics_bank_ege_topic_id", table_name="topics")
    op.drop_column("topics", "bank_ege_topic_id")
    op.drop_column("topics", "exam_task_number")
