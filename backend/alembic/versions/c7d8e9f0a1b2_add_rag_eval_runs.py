"""add rag_eval_runs table

Revision ID: c7d8e9f0a1b2
Revises: b2c3d4e5f6a7
Create Date: 2026-07-10

Backs the admin "Evaluación RAG" panel and scripts/eval_rag.py — stores each
run of the fixed test-query set (precision/recall-style checks against
retrieval + full chat generation) so results can be tracked over time instead
of only living in a local eval_results/*.json file.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'rag_eval_runs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('passed', sa.Integer(), nullable=True),
        sa.Column('total', sa.Integer(), nullable=True),
        sa.Column('avg_retrieval_ms', sa.Float(), nullable=True),
        sa.Column('avg_generation_ms', sa.Float(), nullable=True),
        sa.Column('results', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_rag_eval_runs_created_at', 'rag_eval_runs', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_rag_eval_runs_created_at', table_name='rag_eval_runs')
    op.drop_table('rag_eval_runs')
