"""add lawyer onboarding profile

Revision ID: 3624a224a6d1
Revises: e3e8e3a14c3a
Create Date: 2026-11-09 10:55:37.215946

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3624a224a6d1'
down_revision: Union[str, Sequence[str], None] = 'e3e8e3a14c3a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:

    # Existing users should NOT see onboarding again.
    op.add_column(
        "users",
        sa.Column(
            "onboarding_status",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'completed'")
        )
    )

    op.add_column(
        "users",
        sa.Column("phone_number", sa.String(30), nullable=True)
    )

    op.add_column(
        "users",
        sa.Column("city", sa.String(100), nullable=True)
    )

    op.add_column(
        "users",
        sa.Column("bar_number", sa.String(100), nullable=True)
    )

    op.add_column(
        "users",
        sa.Column("practice_areas", sa.JSON(), nullable=True)
    )

    op.add_column(
        "users",
        sa.Column(
            "preferred_language",
            sa.String(20),
            nullable=False,
            server_default=sa.text("'English'")
        )
    )

    op.add_column(
        "users",
        sa.Column(
            "hearing_reminders",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1")
        )
    )

    op.add_column(
        "users",
        sa.Column(
            "task_reminders",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1")
        )
    )

    op.add_column(
        "users",
        sa.Column(
            "email_notifications",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("1")
        )
    )

    # Future registrations start with pending status.
    op.alter_column(
        "users",
        "onboarding_status",
        existing_type=sa.String(20),
        existing_nullable=False,
        server_default=sa.text("'pending'")
    )


def downgrade() -> None:

    op.drop_column("users", "email_notifications")
    op.drop_column("users", "task_reminders")
    op.drop_column("users", "hearing_reminders")
    op.drop_column("users", "preferred_language")
    op.drop_column("users", "practice_areas")
    op.drop_column("users", "bar_number")
    op.drop_column("users", "city")
    op.drop_column("users", "phone_number")
    op.drop_column("users", "onboarding_status")
