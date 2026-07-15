"""add verification_attempts/verification_approved to messages

Revision ID: d8e9f0a1b2c3
Revises: c7d8e9f0a1b2
Create Date: 2026-07-15

Backs the LangGraph self-correction loop (app/services/verification_graph.py)
and the "Verificación" section on /admin/analytics — persists per-message
whether the answer needed a retry and whether it was ultimately approved,
so the admin panel can show real corrected cases without reading server logs.
NULL for messages the loop never ran on (greetings, refusals, user messages).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd8e9f0a1b2c3'
down_revision: Union[str, None] = 'c7d8e9f0a1b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('messages', sa.Column('verification_attempts', sa.Integer(), nullable=True))
    op.add_column('messages', sa.Column('verification_approved', sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column('messages', 'verification_approved')
    op.drop_column('messages', 'verification_attempts')
