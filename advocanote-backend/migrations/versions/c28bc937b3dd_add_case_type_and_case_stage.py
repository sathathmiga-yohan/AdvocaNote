"""add case type and case stage

Revision ID: c28bc937b3dd
Revises: 9d9dd1fe79b9
Create Date: 2026-10-26 21:40:22.627037

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c28bc937b3dd'
down_revision: Union[str, Sequence[str], None] = '9d9dd1fe79b9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.add_column(
        "hearings",
        sa.Column(
            "purpose",
            sa.String(length=255),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("hearings", "purpose")
