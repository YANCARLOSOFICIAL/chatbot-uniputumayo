"""add taxonomy tables (faculties, programs, document_types)

Revision ID: b2c3d4e5f6a7
Revises: f6a7b8c9d0e1
Create Date: 2026-07-08

Backs the admin taxonomy CRUD (facultad/programa/tipo de documento) so the
upload form selects from a managed list instead of free text.
documents.faculty/program/document_type stay as plain strings (see
routers/documents.py, rag_service.py filters) — these tables are lookup-only,
not FKs, to avoid migrating/backfilling existing document rows.

Seeds document_types with the previously-hardcoded upload <select> options
and faculties/programs from whatever free-text values already exist on
documents, so already-uploaded documents remain editable from the new
dropdowns instead of being orphaned. Case-insensitive dedup (DISTINCT ON
lower(...)) avoids seeding collisions against the new case-insensitive
unique indexes when existing rows differ only by casing.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_SEED_DOCUMENT_TYPES = ["pensum", "perfil", "mision", "reglamento", "admision"]


def upgrade() -> None:
    op.create_table(
        'faculties',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.execute("CREATE UNIQUE INDEX ix_faculties_name_lower ON faculties (lower(name))")

    op.create_table(
        'document_types',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.execute("CREATE UNIQUE INDEX ix_document_types_name_lower ON document_types (lower(name))")

    op.create_table(
        'programs',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('faculty_id', sa.UUID(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['faculty_id'], ['faculties.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name'),
    )
    op.execute("CREATE UNIQUE INDEX ix_programs_name_lower ON programs (lower(name))")

    for name in _SEED_DOCUMENT_TYPES:
        op.execute(
            sa.text(
                "INSERT INTO document_types (id, name, created_at) "
                "VALUES (uuid_generate_v4(), :name, now())"
            ).bindparams(name=name)
        )

    op.execute("""
        INSERT INTO faculties (id, name, created_at)
        SELECT uuid_generate_v4(), sub.faculty, now()
        FROM (
            SELECT DISTINCT ON (lower(faculty)) faculty
            FROM documents
            WHERE faculty IS NOT NULL AND faculty <> ''
            ORDER BY lower(faculty), faculty
        ) sub
    """)
    op.execute("""
        INSERT INTO programs (id, name, created_at)
        SELECT uuid_generate_v4(), sub.program, now()
        FROM (
            SELECT DISTINCT ON (lower(program)) program
            FROM documents
            WHERE program IS NOT NULL AND program <> ''
            ORDER BY lower(program), program
        ) sub
    """)


def downgrade() -> None:
    op.drop_table('programs')
    op.drop_table('document_types')
    op.drop_table('faculties')
