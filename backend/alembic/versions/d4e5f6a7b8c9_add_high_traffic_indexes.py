"""add indexes on high-traffic FK/filter columns

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-03

Postgres does not auto-index foreign keys. These columns are hit on every
chat turn (conversations.user_id + is_active/updated_at for listing,
messages.conversation_id for history/get_messages) or every document
admin action (documents.uploaded_by/program, document_chunks.document_id
for reindex/delete). Composite indexes match the actual filter+order
patterns in chat_service.py/document_service.py instead of single-column
indexes that would only help half the query.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_conversations_user_id_updated_at "
        "ON conversations (user_id, updated_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_conversations_is_active_updated_at "
        "ON conversations (is_active, updated_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_messages_conversation_id_created_at "
        "ON messages (conversation_id, created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_documents_uploaded_by "
        "ON documents (uploaded_by)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_documents_program "
        "ON documents (program)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_document_chunks_document_id "
        "ON document_chunks (document_id)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_conversations_user_id_updated_at")
    op.execute("DROP INDEX IF EXISTS ix_conversations_is_active_updated_at")
    op.execute("DROP INDEX IF EXISTS ix_messages_conversation_id_created_at")
    op.execute("DROP INDEX IF EXISTS ix_documents_uploaded_by")
    op.execute("DROP INDEX IF EXISTS ix_documents_program")
    op.execute("DROP INDEX IF EXISTS ix_document_chunks_document_id")
