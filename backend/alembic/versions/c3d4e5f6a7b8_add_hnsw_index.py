"""add HNSW vector index for fast similarity search

Revision ID: c3d4e5f6a7b8
Revises: a1b2c3d4e5f6
Create Date: 2026-06-26

An HNSW index on document_chunks.embedding reduces vector search from O(n)
full-table-scan to O(log n) approximate nearest-neighbor, critical once the
corpus grows beyond a few hundred chunks.

Parameters chosen for a ~10K-chunk corpus on a CPU-only server:
  m=16            — graph connectivity, controls recall/memory trade-off
  ef_construction=64 — quality of index build (higher = better recall, slower build)
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Partial index: only non-NULL embeddings are indexed (chunks mid-ingestion may be NULL)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_dc_embedding_hnsw
        ON document_chunks
        USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
        WHERE embedding IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_dc_embedding_hnsw")
