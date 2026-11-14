
"""allow manual tasks

Revision ID: c5ba33c8d092
Revises: 4138f2f6e75f
Create Date: 2026-10-28 18:56:33.919453
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision: str = "c5ba33c8d092"

down_revision: Union[str, Sequence[str], None] = (
    "4138f2f6e75f"
)

branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Keep tasks.diary_entry_id nullable=True.
    # It was already updated in the previous migration.

    # AI suggestions can exist without a diary entry.
    op.alter_column(
        "ai_suggestions",
        "diary_entry_id",
        existing_type=mysql.INTEGER(),
        nullable=True,
        existing_nullable=False,
    )


def downgrade() -> None:
    # Revert only the change introduced
    # by this migration.
    op.alter_column(
        "ai_suggestions",
        "diary_entry_id",
        existing_type=mysql.INTEGER(),
        nullable=False,
        existing_nullable=True,
    )
