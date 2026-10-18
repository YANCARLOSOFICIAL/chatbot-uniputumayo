"""add faq_entries table and message answer_source

Revision ID: b7c8d9e0f1a2
Revises: 05b3dfce437a
Create Date: 2026-10-17 10:00:00.000000

Curated "Preguntas frecuentes" (see app/models/faq_entry.py and
app/services/faq_service.py): admin-written question/answer pairs matched
against the user's question by embedding similarity BEFORE the answer cache
and RAG run, so the most repeated questions are answered without any LLM
call. `messages.answer_source` / `messages.faq_entry_id` record how each
assistant answer was produced, for analytics.

The embedding column dimension must match settings.faq_embedding_dimensions
(embeddinggemma = 768). No HNSW index: the table holds tens of rows, a
sequential scan is faster than maintaining an index.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector


# revision identifiers, used by Alembic.
revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, None] = '05b3dfce437a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_FAQ_EMBEDDING_DIMENSIONS = 768


def upgrade() -> None:
    op.create_table(
        'faq_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('answer', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True),
        sa.Column('source_document', sa.String(length=255), nullable=True),
        sa.Column('valid_period', sa.String(length=100), nullable=True),
        sa.Column('program', sa.String(length=255), nullable=True),
        sa.Column('faculty', sa.String(length=255), nullable=True),
        sa.Column('is_enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('embedding', Vector(_FAQ_EMBEDDING_DIMENSIONS), nullable=True),
        sa.Column('embedding_model', sa.String(length=100), nullable=True),
        sa.Column('hit_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index('ix_faq_entries_enabled_order', 'faq_entries', ['is_enabled', 'sort_order'])

    op.add_column('messages', sa.Column('answer_source', sa.String(length=20), nullable=True))
    op.add_column(
        'messages',
        sa.Column('faq_entry_id', postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        'fk_messages_faq_entry_id', 'messages', 'faq_entries',
        ['faq_entry_id'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_messages_faq_entry_id', 'messages', type_='foreignkey')
    op.drop_column('messages', 'faq_entry_id')
    op.drop_column('messages', 'answer_source')
    op.drop_index('ix_faq_entries_enabled_order', table_name='faq_entries')
    op.drop_table('faq_entries')
