"""add conversation context summary

Revision ID: 05b3dfce437a
Revises: d5e6f7a8b9c0
Create Date: 2026-08-31 18:43:59.184068

Backs the incremental "summary buffer" conversational memory (see
chat_service.py::_refresh_context_summary) — lets OpenAI query condensation
see the whole conversation, not just the last _MAX_HISTORY_MESSAGES raw
messages, at ~constant cost per turn.

Autogenerate also flagged a long list of index drop/create pairs for indexes
that exist in the DB (HNSW, FTS GIN, etc., created via raw SQL in earlier
migrations) but aren't declared on the SQLAlchemy models — those are
autogenerate false positives, not real schema drift, and are deliberately
NOT included here. This migration touches only the two new columns.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '05b3dfce437a'
down_revision: Union[str, None] = 'd5e6f7a8b9c0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('conversations', sa.Column('context_summary', sa.Text(), nullable=True))
    op.add_column(
        'conversations',
        sa.Column('summary_covers_messages', sa.Integer(), nullable=False, server_default='0'),
    )
    # Drop the server_default once existing rows are backfilled — new rows
    # get their value from the ORM model's `default=0`, not the DB default.
    op.alter_column('conversations', 'summary_covers_messages', server_default=None)


def downgrade() -> None:
    op.drop_column('conversations', 'summary_covers_messages')
    op.drop_column('conversations', 'context_summary')
