"""add lawyer professional profile fields

Revision ID: 9e57dd0418e7
Revises: ead393f05b53
Create Date: 2026-11-09 12:37:19.657617

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9e57dd0418e7'
down_revision: Union[str, Sequence[str], None] = 'ead393f05b53'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "professional_title",
            sa.String(length=80),
            nullable=True,
        ),
    )

    op.add_column(
        "users",
        sa.Column(
            "law_firm",
            sa.String(length=150),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "law_firm")
    op.drop_column("users", "professional_title")
