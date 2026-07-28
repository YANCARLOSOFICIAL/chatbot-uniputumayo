"""add password_reset_token/password_reset_expires_at to users

Revision ID: b3c4d5e6f7a8
Revises: d8e9f0a1b2c3
Create Date: 2026-07-28

Backs the self-service "forgot password" flow (app/routers/auth.py +
app/services/email_service.py, sent via Resend) — a single-use, time-limited
token stored per user instead of a separate table, since only one reset
request needs to be live at a time (a new request simply overwrites it).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = 'd8e9f0a1b2c3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('password_reset_token', sa.String(length=255), nullable=True))
    op.add_column('users', sa.Column('password_reset_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint('uq_users_password_reset_token', 'users', ['password_reset_token'])


def downgrade() -> None:
    op.drop_constraint('uq_users_password_reset_token', 'users', type_='unique')
    op.drop_column('users', 'password_reset_expires_at')
    op.drop_column('users', 'password_reset_token')
