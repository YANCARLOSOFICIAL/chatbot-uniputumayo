"""add gold_eval_runs table

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-07-28

Backs the admin-uploaded GoldStandard.xlsx evaluation (Precision@k, Recall@k,
MRR, hallucination rate, safe-rejection rate) comparing two LLM providers —
see app/services/goldstandard_eval_service.py.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, None] = 'c4d5e6f7a8b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'gold_eval_runs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('k', sa.Integer(), nullable=False),
        sa.Column('total_queries', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('results', postgresql.JSONB(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('gold_eval_runs')
