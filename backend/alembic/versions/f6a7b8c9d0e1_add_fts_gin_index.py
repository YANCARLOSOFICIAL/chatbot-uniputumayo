"""add GIN full-text index on document_chunks.content

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-07-03

Backs the new hybrid keyword+vector retrieval in rag_service.py
(_keyword_search), which runs `to_tsvector('spanish', content) @@
plainto_tsquery(...)` to widen recall beyond pure cosine similarity.
Without this index Postgres would re-tokenize every chunk's content on
every query — fine for a few hundred chunks, a full-table scan once the
corpus grows.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_dc_content_fts
        ON document_chunks
        USING gin (to_tsvector('spanish', content))
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_dc_content_fts")
